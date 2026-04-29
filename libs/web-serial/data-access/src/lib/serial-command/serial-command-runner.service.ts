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
  SERIAL_TIMEOUT,
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
 * {@link SerialTransportService#getReadStream}（= `SerialSession.lines$` と同根の**行**ストリーム）のみを購読する。
 * プロンプト・ログイン判定は **行単位**に strip したテキストを {@link readBuffer} に連結して行い、
 * 判定は {@link SerialPromptDetectorService} に委ねる。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialCommandRunnerService {
  private readBuffer = '';
  private readSubscription: Subscription | null = null;
  /** 受信行でバッファが更新されたことを Observable 側の待機に伝える */
  private readonly bufferNotify$ = new Subject<void>();

  constructor(
    private readonly transport: SerialTransportService,
    private readonly promptDetector: SerialPromptDetectorService,
    private readonly commandQueue: SerialCommandQueueService,
  ) {}

  /**
   * 接続後に呼び出し、`lines$` 経路（{@link SerialTransportService#getReadStream}）だけを購読する。
   * 各エミットは 1 行。プロンプト検出用に {@link stripLineForPromptDetection} 後の行＋改行を {@link readBuffer} へ蓄積する。
   */
  startReadLoop(): void {
    this.readBuffer = '';
    this.readSubscription?.unsubscribe();
    this.readSubscription = this.transport.getReadStream().subscribe({
      next: (line) => {
        this.readBuffer +=
          stripLineForPromptDetection(line) +
          '\n';
        this.bufferNotify$.next();
      },
      error: (err) => console.error('Serial read stream error:', err),
    });
  }

  /**
   * 読み取り購読を停止しバッファを空にする
   */
  stopReadLoop(): void {
    this.readSubscription?.unsubscribe();
    this.readSubscription = null;
    this.readBuffer = '';
  }

  /**
   * 読み取りストリームを購読中か
   */
  isReading(): boolean {
    return this.readSubscription != null && !this.readSubscription.closed;
  }

  private clearReadBuffer(): void {
    this.readBuffer = '';
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
        return this.readBuffer;
      }),
      filter((buf) => this.bufferMatchesPrompt(buf, config)),
      take(1),
      map((buf) => {
        const stdout = buf;
        this.readBuffer = '';
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
        mergeMap(() => this.waitForPromptMatch$(config, enqueuedGen)),
        map((stdout) => ({ stdout })),
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
      if (this.bufferMatchesPrompt(this.readBuffer, config)) {
        const stdout = this.readBuffer;
        this.readBuffer = '';
        return of<CommandResult>({ stdout });
      }
      return this.waitForPromptMatch$(config, enqueuedGen).pipe(
        map((stdout) => ({ stdout })),
      );
    });
    return this.withPromptAttemptRetries(attempt$, retryCount);
  }

  serialOptionsToConfig(options: SerialExecOptions): CommandExecutionConfig {
    const {
      prompt,
      promptMatch,
      timeout = SERIAL_TIMEOUT.DEFAULT,
      retry = 0,
    } = options;
    if (promptMatch === undefined && prompt === undefined) {
      throw new Error('SerialExecOptions: prompt or promptMatch is required');
    }
    return {
      prompt: prompt ?? '',
      promptMatch,
      timeout,
      retry,
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
