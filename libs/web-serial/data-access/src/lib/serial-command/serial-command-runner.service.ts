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
  DEFAULT_SERIAL_EXEC_OPTIONS,
  mergeSerialExecOptions,
  stripSerialAnsiForPrompt,
  type SerialExecOptions,
} from '@libs-web-serial-util';
import { stripLineForPromptDetection } from './ansi-strip.util';
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
 * {@link SerialTransportService#getReadStream}（行）と {@link SerialTransportService#receive$}（生チャンク）を購読する。
 *
 * ### 行未完（issue: Web Serial でプロンプトが lone \\r で改行しない）
 *
 * `lines$` だけだと未完行が {@link readBuffer} に載らずプロンプト待ちがタイムアウトする場合があるため、
 * `receive$` の末尾のみ（最大 {@link RECEIVE_TAIL_MAX_LEN}）を strip 後に別バッファに保持し、
 * プロンプト照合対象として {@link readBuffer} と連結する。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialCommandRunnerService {
  private static readonly RECEIVE_TAIL_MAX_LEN = 6_144;

  private readBuffer = '';
  private readSubscription: Subscription | null = null;
  private rawReceiveTail = '';
  private receiveSubscription: Subscription | null = null;
  /** 受信行でバッファが更新されたことを Observable 側の待機に伝える */
  private readonly bufferNotify$ = new Subject<void>();

  constructor(
    private readonly transport: SerialTransportService,
    private readonly promptDetector: SerialPromptDetectorService,
    private readonly commandQueue: SerialCommandQueueService,
  ) {}

  /**
   * 接続後に呼び出し、`getReadStream`（行）と `receive$` を購読する。
   */
  startReadLoop(): void {
    this.readBuffer = '';
    this.rawReceiveTail = '';
    this.readSubscription?.unsubscribe();
    this.receiveSubscription?.unsubscribe();
    this.readSubscription = this.transport.getReadStream().subscribe({
      next: (line) => {
        this.readBuffer +=
          stripLineForPromptDetection(line) +
          '\n';
        this.bufferNotify$.next();
      },
      error: (err) => console.error('Serial read stream error:', err),
    });
    this.receiveSubscription = this.transport.receive$.subscribe({
      next: (chunk) => {
        if (!chunk?.length) {
          return;
        }
        const cleaned = stripSerialAnsiForPrompt(chunk);
        this.rawReceiveTail = (
          this.rawReceiveTail + cleaned
        ).slice(-SerialCommandRunnerService.RECEIVE_TAIL_MAX_LEN);
        this.bufferNotify$.next();
      },
      error: (err: unknown) => console.error('Serial receive stream error:', err),
    });
  }

  /**
   * 読み取り購読を停止しバッファを空にする
   */
  stopReadLoop(): void {
    this.readSubscription?.unsubscribe();
    this.readSubscription = null;
    this.receiveSubscription?.unsubscribe();
    this.receiveSubscription = null;
    this.readBuffer = '';
    this.rawReceiveTail = '';
  }

  /**
   * 読み取りストリームを購読中か
   */
  isReading(): boolean {
    return (
      this.readSubscription != null &&
      !this.readSubscription.closed &&
      this.receiveSubscription != null &&
      !this.receiveSubscription.closed
    );
  }

  private clearReadBuffer(): void {
    this.readBuffer = '';
    this.rawReceiveTail = '';
  }

  /**
   * getty が `\r` のみで行を終わらせたり、chunks が `\r` / `\r\n` 混在だとプロンプト正規表現がずれる。
   * 行バッファと受信テールを連結した直後に適用する。
   */
  private normalizeInspectionBufferText(s: string): string {
    return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  /** lines$ の完了行 + receive$ の未完テキスト末尾（プロンプト照合用） */
  private promptInspectionBuffer(): string {
    const raw =
      this.readBuffer.length > 0
        ? `${this.readBuffer}${this.rawReceiveTail}`
        : this.rawReceiveTail;
    return this.normalizeInspectionBufferText(raw);
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
        this.readBuffer = '';
        this.rawReceiveTail = '';
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
