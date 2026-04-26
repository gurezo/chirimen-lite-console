/// <reference types="@types/w3c-web-serial" />

import { Injectable } from '@angular/core';
import {
  Observable,
  Subject,
  Subscription,
  TimeoutError,
  catchError,
  concatMap,
  defer,
  EMPTY,
  filter,
  finalize,
  map,
  mergeMap,
  of,
  retry,
  startWith,
  take,
  throwError,
  timeout,
} from 'rxjs';
import { stripSerialAnsiForPrompt } from '@libs-web-serial-util';
import { SerialTransportService } from './serial-transport.service';

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
 * Serial コマンド実行サービス
 *
 * 読み取りバッファ・ストリーム購読・プロンプト待ち・書き込みを担当
 */
@Injectable({
  providedIn: 'root',
})
export class SerialCommandService {
  private readBuffer = '';
  private readSubscription: Subscription | null = null;
  /** 受信チャンクでバッファが更新されたことを Observable 側の待機に伝える */
  private readonly bufferNotify$ = new Subject<void>();
  /** コマンド実行を直列化（複数 exec$ が同時に走らない） */
  private readonly executionQueue$ = new Subject<Observable<unknown>>();
  /** cancelAllCommands 用。enqueue 時点の世代と異なれば実行を打ち切る */
  private generation = 0;
  private pendingCount = 0;

  constructor(private readonly transport: SerialTransportService) {
    this.executionQueue$
      .pipe(
        concatMap((work) =>
          work.pipe(
            catchError((err: unknown) => {
              console.error('Serial command queue work error:', err);
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe();
  }

  private matchesPrompt(input: string, prompt: string | RegExp): boolean {
    if (typeof prompt === 'string') {
      return input.includes(prompt);
    }
    prompt.lastIndex = 0;
    return prompt.test(input);
  }

  /**
   * 接続後に呼び出し、シリアル読み取りを購読してバッファに蓄積する
   */
  startReadLoop(): void {
    this.readBuffer = '';
    this.readSubscription?.unsubscribe();
    this.readSubscription = this.transport.getReadStream().subscribe({
      next: (chunk) => {
        this.readBuffer += stripSerialAnsiForPrompt(chunk);
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

  private enqueueCommand$<T>(
    factory: (enqueuedGen: number) => Observable<T>,
  ): Observable<T> {
    return new Observable<T>((subscriber) => {
      const enqueuedGen = this.generation;
      this.pendingCount++;
      this.executionQueue$.next(
        defer(() => {
          if (this.generation !== enqueuedGen) {
            return throwError(() => new Error('All commands cancelled'));
          }
          return factory(enqueuedGen);
        }).pipe(
          finalize(() => {
            this.pendingCount--;
          }),
          mergeMap((value) => {
            subscriber.next(value as T);
            subscriber.complete();
            return EMPTY;
          }),
          catchError((err: unknown) => {
            subscriber.error(err);
            return EMPTY;
          }),
        ),
      );
    });
  }

  private waitForPromptMatch$(
    config: CommandExecutionConfig,
    enqueuedGen: number,
  ): Observable<string> {
    return this.bufferNotify$.pipe(
      startWith(undefined),
      map(() => {
        if (this.generation !== enqueuedGen) {
          throw new Error('All commands cancelled');
        }
        return this.readBuffer;
      }),
      filter((buf) => this.matchesPrompt(buf, config.prompt)),
      take(1),
      map((buf) => {
        const stdout = buf;
        this.readBuffer = '';
        return stdout;
      }),
      timeout({ first: config.timeout }),
      catchError((err: unknown) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new Error('Command execution timeout'));
        }
        return throwError(() => err);
      }),
    );
  }

  private buildExecPipeline$(
    sendData: string,
    config: CommandExecutionConfig,
    enqueuedGen: number,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    const retryCount = config.retry ?? 0;
    const attempt$ = defer(() => {
      if (this.generation !== enqueuedGen) {
        return throwError(() => new Error('All commands cancelled'));
      }
      onAttemptStart?.();
      this.clearReadBuffer();
      return this.transport.write(sendData).pipe(
        mergeMap(() => this.waitForPromptMatch$(config, enqueuedGen)),
        map((stdout) => ({ stdout })),
      );
    });
    return attempt$.pipe(retry({ count: retryCount }));
  }

  private buildReadUntilPromptPipeline$(
    config: CommandExecutionConfig,
    enqueuedGen: number,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    const retryCount = config.retry ?? 0;
    const attempt$ = defer(() => {
      if (this.generation !== enqueuedGen) {
        return throwError(() => new Error('All commands cancelled'));
      }
      onAttemptStart?.();
      if (this.matchesPrompt(this.readBuffer, config.prompt)) {
        const stdout = this.readBuffer;
        this.readBuffer = '';
        return of<CommandResult>({ stdout });
      }
      return this.waitForPromptMatch$(config, enqueuedGen).pipe(
        map((stdout) => ({ stdout })),
      );
    });
    return attempt$.pipe(retry({ count: retryCount }));
  }

  /**
   * コマンド実行（stdin に `cmd + '\n'` を送信し、prompt まで待機）
   */
  exec$(
    cmd: string,
    config: CommandExecutionConfig,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    return this.enqueueCommand$((enqueuedGen) =>
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
    return this.enqueueCommand$((enqueuedGen) =>
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
    return this.enqueueCommand$((enqueuedGen) =>
      this.buildReadUntilPromptPipeline$(
        config,
        enqueuedGen,
        onAttemptStart,
      ),
    );
  }

  /**
   * 単一の待機 ID によるキャンセルはサポートしない（世代ベースの cancelAllCommands を利用）。
   */
  cancelCommand(commandId: string): void {
    void commandId;
  }

  cancelAllCommands(): void {
    this.generation++;
  }

  getPendingCommandCount(): number {
    return this.pendingCount;
  }
}
