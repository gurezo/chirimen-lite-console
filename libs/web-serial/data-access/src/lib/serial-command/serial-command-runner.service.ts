/// <reference types="@types/w3c-web-serial" />

/** Full rewrite (#606). Prompt/exec buffer from {@link SerialTransportService#lines$} (`SerialSession`). */
import { Injectable } from '@angular/core';
import {
  Observable,
  Subject,
  Subscription,
  TimeoutError,
  catchError,
  defer,
  filter,
  map,
  mergeMap,
  of,
  retry,
  startWith,
  take,
  throwError,
  timeout,
} from 'rxjs';
import {
  collapseCarriageRedrawsPerLine,
  DEFAULT_SERIAL_EXEC_OPTIONS,
  mergeSerialExecOptions,
  stripSerialAnsiForPrompt,
  type SerialExecOptions,
} from '@libs-web-serial-util';
import type {
  CommandExecutionConfig,
  CommandResult,
} from './serial-command-types';
import { SerialPromptDetectorService } from './serial-prompt-detector.service';
import { SerialCommandQueueService } from './serial-command-queue.service';
import { SerialTransportService } from '../serial-transport.service';

/**
 * シリアルへの送信・プロンプト待ち・タイムアウト・再試行（キューとは別層）。
 *
 * ### 受信（#593）
 *
 * プロンプト照合および exec の `stdout` は {@link SerialTransportService#receive$} の生チャンクを連結し、
 * {@link collapseCarriageRedrawsPerLine} で論理表示に収束させたバッファで行う（getty の lone `\r` 行末で
 * {@link SerialTransportService#lines$} が空振りする問題の回避）。
 * ターミナル上のライブ表示は {@link SerialTransportService#terminalText$} に委譲する。
 *
 * 各チャンクに {@link stripSerialAnsiForPrompt} を適用する。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialCommandRunnerService {
  private static readonly READ_BUFFER_CAP = 96_000;

  private readBuffer = '';
  private rxSubscription: Subscription | null = null;
  /** 受信チャンクでバッファが更新されたことを Observable 側の待機に伝える */
  private readonly bufferNotify$ = new Subject<void>();

  constructor(
    private readonly transport: SerialTransportService,
    private readonly promptDetector: SerialPromptDetectorService,
    private readonly commandQueue: SerialCommandQueueService,
  ) {}

  /**
   * 接続後に呼び出し、`receive$` を購読してプロンプト照合用 `readBuffer` に追記する。
   */
  startReadLoop(): void {
    this.readBuffer = '';
    this.rxSubscription?.unsubscribe();
    this.rxSubscription = this.transport.receive$.subscribe({
      next: (chunk) => {
        const piece = stripSerialAnsiForPrompt(chunk ?? '');
        this.readBuffer += piece;
        if (this.readBuffer.length > SerialCommandRunnerService.READ_BUFFER_CAP) {
          this.readBuffer = this.readBuffer.slice(
            -SerialCommandRunnerService.READ_BUFFER_CAP,
          );
        }
        this.bufferNotify$.next();
      },
      error: (err: unknown) => console.error('Serial receive stream error:', err),
    });
  }

  /**
   * 読み取り購読を停止しバッファを空にする
   */
  stopReadLoop(): void {
    this.rxSubscription?.unsubscribe();
    this.rxSubscription = null;
    this.readBuffer = '';
  }

  /**
   * 読み取り購読中か
   */
  isReading(): boolean {
    return (
      this.rxSubscription != null &&
      !this.rxSubscription.closed
    );
  }

  private clearReadBuffer(): void {
    this.readBuffer = '';
  }

  /**
   * バッファ正規化: `\r`・`\r\n` を「論理表示」へ収束させる（{@link collapseCarriageRedrawsPerLine}）。
   */
  private normalizeInspectionBufferText(s: string): string {
    return collapseCarriageRedrawsPerLine(s);
  }

  /** プロンプト照合用のバッファ */
  private promptInspectionBuffer(): string {
    return this.normalizeInspectionBufferText(this.readBuffer);
  }

  /**
   * 1 試行あたりのプロンプト待ち。
   * 受信バッファがプロンプトに一致するまで待ち、**初回一致まで**が `config.timeout` で打ち切られる。
   */
  private waitForPromptMatch$(
    config: CommandExecutionConfig,
    enqueuedGen: number,
  ): Observable<string> {
    return this.bufferNotify$.pipe(
      startWith(undefined),
      map(() => {
        if (!this.commandQueue.isGenerationActive(enqueuedGen)) {
          throw new Error('All commands cancelled');
        }
        return this.promptInspectionBuffer();
      }),
      filter((buf) => this.bufferMatchesPrompt(buf, config)),
      take(1),
      map((buf) => {
        const stdout = buf;
        this.clearReadBuffer();
        return stdout;
      }),
      timeout({ first: config.timeout }),
      catchError((err: unknown) => this.mapPromptWaitError$(err)),
    );
  }

  private mapPromptWaitError$(err: unknown): Observable<never> {
    if (err instanceof TimeoutError) {
      return throwError(() => new Error('Command execution timeout'));
    }
    return throwError(() => err);
  }

  /**
   * `retry({ count })` はこの Observable をエラー時に再購読する。
   * `defer` 内が毎回やり直されるため、**送信・バッファクリア・プロンプト待ちが 1 試行単位**で繰り返される。
   */
  private withPromptAttemptRetries<T>(
    attempt$: Observable<T>,
    retryCount: number,
  ): Observable<T> {
    return attempt$.pipe(retry({ count: retryCount }));
  }

  /** 送信完了後: プロンプト待ちしない場合は空 stdout、否则 {@link waitForPromptMatch$}。 */
  private afterSendPromptOutcome$(
    config: CommandExecutionConfig,
    enqueuedGen: number,
  ): Observable<CommandResult> {
    if (config.waitForPrompt === false) {
      return of({ stdout: '' });
    }
    return this.waitForPromptMatch$(config, enqueuedGen).pipe(
      map((stdout) => ({ stdout })),
    );
  }

  /**
   * 送信なし: 既存バッファで一致すれば即返し、否则プロンプトまで待機。
   */
  private readUntilPromptOutcome$(
    config: CommandExecutionConfig,
    enqueuedGen: number,
  ): Observable<CommandResult> {
    if (config.waitForPrompt === false) {
      const stdout = this.promptInspectionBuffer();
      this.clearReadBuffer();
      return of({ stdout });
    }
    if (this.bufferMatchesPrompt(this.promptInspectionBuffer(), config)) {
      const stdout = this.promptInspectionBuffer();
      this.clearReadBuffer();
      return of({ stdout });
    }
    return this.waitForPromptMatch$(config, enqueuedGen).pipe(
      map((stdout) => ({ stdout })),
    );
  }

  buildExecPipeline$(
    sendData: string,
    config: CommandExecutionConfig,
    enqueuedGen: number,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    const retryCount = config.retry ?? 0;
    const attempt$ = defer(() => {
      if (!this.commandQueue.isGenerationActive(enqueuedGen)) {
        return throwError(() => new Error('All commands cancelled'));
      }
      onAttemptStart?.();
      this.clearReadBuffer();
      return this.transport.send$(sendData).pipe(
        mergeMap(() => this.afterSendPromptOutcome$(config, enqueuedGen)),
      );
    });
    return this.withPromptAttemptRetries(attempt$, retryCount);
  }

  buildReadUntilPromptPipeline$(
    config: CommandExecutionConfig,
    enqueuedGen: number,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    const retryCount = config.retry ?? 0;
    const attempt$ = defer(() => {
      if (!this.commandQueue.isGenerationActive(enqueuedGen)) {
        return throwError(() => new Error('All commands cancelled'));
      }
      onAttemptStart?.();
      return this.readUntilPromptOutcome$(config, enqueuedGen);
    });
    return this.withPromptAttemptRetries(attempt$, retryCount);
  }

  serialOptionsToConfig(options: SerialExecOptions): CommandExecutionConfig {
    const m = mergeSerialExecOptions(options);
    const { prompt, promptMatch, waitForPrompt } = m;
    const timeout = m.timeout ?? DEFAULT_SERIAL_EXEC_OPTIONS.timeout;
    const retry = m.retry ?? DEFAULT_SERIAL_EXEC_OPTIONS.retry;
    if (promptMatch === undefined && prompt === undefined) {
      throw new Error('SerialExecOptions: prompt or promptMatch is required');
    }
    return {
      prompt: prompt ?? '',
      promptMatch,
      timeout,
      retry,
      waitForPrompt,
    };
  }

  private bufferMatchesPrompt(
    buffer: string,
    config: CommandExecutionConfig,
  ): boolean {
    if (config.promptMatch) {
      return config.promptMatch(buffer);
    }
    return this.promptDetector.matchesPrompt(buffer, config.prompt);
  }
}
