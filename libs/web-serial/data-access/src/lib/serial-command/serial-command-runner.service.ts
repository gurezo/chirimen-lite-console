/// <reference types="@types/w3c-web-serial" />

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
 * ### 受信（issue #559）
 *
 * プロンプト照合および exec の `stdout` は {@link SerialTransportService#receive$} の **生チャンク**のみを連結したバッファを使う。
 *
 * **`lines$`（{@link SerialTransportService#getReadStream}）では使わない。**
 *
 * `@gurezo/web-serial-rxjs` の {@link SerialSession.lines$} は内部 `line-buffer` が lone `\r` を「行終端」とみなし、
 * TTY が同一論理出力で `\r` 再描画した断片を **複数論理「行」**として emit する。その結果 `readBuffer` に `\r` が残らず
 * 「最終 `\r` セグメントへ収束」できず、`ls` 等が xterm で階段状に見える。
 *
 * 生チャンクを `\n`/`\r` が混じったまま累積し、{@link collapseCarriageRedrawsPerLine} で論理表示に収束させる。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialCommandRunnerService {
  private readBuffer = '';
  private receiveSubscription: Subscription | null = null;
  /** 受信チャンクでバッファが更新されたことを Observable 側の待機に伝える */
  private readonly bufferNotify$ = new Subject<void>();

  constructor(
    private readonly transport: SerialTransportService,
    private readonly promptDetector: SerialPromptDetectorService,
    private readonly commandQueue: SerialCommandQueueService,
  ) {}

  /**
   * 接続後に呼び出し、`receive$` を購読して `readBuffer` に追記する。
   */
  startReadLoop(): void {
    this.readBuffer = '';
    this.receiveSubscription?.unsubscribe();
    this.receiveSubscription = this.transport.receive$.subscribe({
      next: (chunk) => {
        if (!chunk?.length) {
          return;
        }
        this.readBuffer += stripSerialAnsiForPrompt(chunk);
        this.bufferNotify$.next();
      },
      error: (err: unknown) => console.error('Serial receive stream error:', err),
    });
  }

  /**
   * 読み取り購読を停止しバッファを空にする
   */
  stopReadLoop(): void {
    this.receiveSubscription?.unsubscribe();
    this.receiveSubscription = null;
    this.readBuffer = '';
  }

  /**
   * 読み取り購読中か
   */
  isReading(): boolean {
    return (
      this.receiveSubscription != null &&
      !this.receiveSubscription.closed
    );
  }

  private clearReadBuffer(): void {
    this.readBuffer = '';
  }

  /** プロンプト照合用のバッファ */
  private promptInspectionBuffer(): string {
    return collapseCarriageRedrawsPerLine(this.readBuffer);
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
      return this.transport.write(sendData).pipe(
        mergeMap(() => {
          if (config.waitForPrompt === false) {
            return of<CommandResult>({ stdout: '' });
          }
          return this.waitForPromptMatch$(config, enqueuedGen).pipe(
            map((stdout) => ({ stdout })),
          );
        }),
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
      if (config.waitForPrompt === false) {
        const stdout = this.promptInspectionBuffer();
        this.clearReadBuffer();
        return of<CommandResult>({ stdout });
      }
      if (this.bufferMatchesPrompt(this.promptInspectionBuffer(), config)) {
        const stdout = this.promptInspectionBuffer();
        this.clearReadBuffer();
        return of<CommandResult>({ stdout });
      }
      return this.waitForPromptMatch$(config, enqueuedGen).pipe(
        map((stdout) => ({ stdout })),
      );
    });
    return this.withPromptAttemptRetries(attempt$, retryCount);
  }

  serialOptionsToConfig(options: SerialExecOptions): CommandExecutionConfig {
    const m = mergeSerialExecOptions(options);
    const { prompt, promptMatch, waitForPrompt } = m;
    const timeout =
      m.timeoutMs ??
      m.timeout ??
      DEFAULT_SERIAL_EXEC_OPTIONS.timeoutMs;
    const retry =
      m.retryCount ?? m.retry ?? DEFAULT_SERIAL_EXEC_OPTIONS.retryCount;
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
