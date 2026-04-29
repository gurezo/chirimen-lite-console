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
import { CommandQueueService } from './command-queue.service';
import { matchesPrompt } from './prompt-detector.util';
import { SerialTransportService } from '../serial-transport.service';

/**
 * コマンド実行設定
 */
export interface CommandExecutionConfig {
  /** 期待するプロンプト文字列 */
  prompt: string | RegExp;
  /** タイムアウト時間（ミリ秒） */
  timeout: number;
  /** タイムアウト等失敗時の再試行回数 */
  retry?: number;
}

/**
 * シリアル上でのコマンド実行結果
 *
 * Web Serial の API では exit code や stderr を分離して取得できないため、
 * 現状は stdout 相当の文字列のみを格納します。
 */
export interface CommandResult {
  stdout: string;
  stderr?: string;
  exitCode?: number;
}

/**
 * Serial 上のコマンド実行・プロンプト待ち。
 *
 * ### 受信（issue #559）
 *
 * {@link SerialTransportService#getReadStream}（= `SerialSession.lines$` と同根の**行**ストリーム）のみを購読する。
 * プロンプト・ログイン判定は **行単位**に strip したテキストを {@link readBuffer} に連結して行い、`receive$` / `receiveReplay$` の
 * チャンク境界には依存しない（ANSI 除去は {@link stripLineForPromptDetection}）。
 *
 * ライブラリの行分割と役割が重なるが、`readBuffer` は「複数行にまたがるマッチ」とコマンド境界でのクリアに必須であり、
 * ライブラリ内バッファとの二重ではない。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialCommandService {
  private readBuffer = '';
  private readSubscription: Subscription | null = null;
  /** 受信行でバッファが更新されたことを Observable 側の待機に伝える */
  private readonly bufferNotify$ = new Subject<void>();

  constructor(
    private readonly transport: SerialTransportService,
    private readonly commandQueue: CommandQueueService,
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
      filter((buf) => matchesPrompt(buf, config.prompt)),
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

  private buildExecPipeline$(
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

  private buildReadUntilPromptPipeline$(
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
      if (matchesPrompt(this.readBuffer, config.prompt)) {
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

  private serialOptionsToConfig(
    options: SerialExecOptions,
  ): CommandExecutionConfig {
    const {
      prompt,
      timeout = SERIAL_TIMEOUT.DEFAULT,
      retry = 0,
    } = options;
    return { prompt, timeout, retry };
  }

  /**
   * {@link SerialExecOptions}（timeout / retry の既定あり）でコマンド実行
   */
  execWithSerialOptions$(
    cmd: string,
    options: SerialExecOptions,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    return this.exec$(
      cmd,
      this.serialOptionsToConfig(options),
      onAttemptStart,
    );
  }

  execRawWithSerialOptions$(
    cmdRaw: string,
    options: SerialExecOptions,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    return this.execRaw$(
      cmdRaw,
      this.serialOptionsToConfig(options),
      onAttemptStart,
    );
  }

  readUntilPromptWithSerialOptions$(
    options: SerialExecOptions,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    return this.readUntilPrompt$(
      this.serialOptionsToConfig(options),
      onAttemptStart,
    );
  }

  /**
   * コマンド実行（stdin に `cmd + '\n'` を送信し、prompt まで待機）
   */
  exec$(
    cmd: string,
    config: CommandExecutionConfig,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    return this.commandQueue.enqueueCommand$((enqueuedGen) =>
      this.buildExecPipeline$(cmd + '\n', config, enqueuedGen, onAttemptStart),
    );
  }

  /**
   * raw コマンド実行（stdin に `cmdRaw` をそのまま送信）
   */
  execRaw$(
    cmdRaw: string,
    config: CommandExecutionConfig,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    return this.commandQueue.enqueueCommand$((enqueuedGen) =>
      this.buildExecPipeline$(cmdRaw, config, enqueuedGen, onAttemptStart),
    );
  }

  /**
   * 読み取りのみ（送信せず prompt まで待機）
   */
  readUntilPrompt$(
    config: CommandExecutionConfig,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    return this.commandQueue.enqueueCommand$((enqueuedGen) =>
      this.buildReadUntilPromptPipeline$(
        config,
        enqueuedGen,
        onAttemptStart,
      ),
    );
  }

  cancelAllCommands(): void {
    this.commandQueue.cancelAllCommands();
  }

  getPendingCommandCount(): number {
    return this.commandQueue.getPendingCommandCount();
  }
}
