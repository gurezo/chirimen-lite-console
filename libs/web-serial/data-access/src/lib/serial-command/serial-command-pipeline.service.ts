/// <reference types="@types/w3c-web-serial" />

/**
 * Command 実行の統合パイプライン（Issue #663）。
 * 直列キュー・`receive$` バッファ・プロンプト待ち・送信・キャンセルを 1 クラスに集約する。
 */
import { Injectable } from '@angular/core';
import {
  EMPTY,
  Observable,
  Subject,
  Subscriber,
  Subscription,
  TimeoutError,
  catchError,
  concatMap,
  defer,
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
import { SerialTransportService } from '../serial-transport.service';

/** {@link SerialCommandPipelineService#enqueueCommand$} のキュー制御オプション（issue #565） */
export interface SerialCommandEnqueueOptions {
  /**
   * `true` のとき、この enqueue の直前に **まだ実行が始まっていない** 先行ジョブを棄却する。
   * 実行中のジョブは止めない。{@link SerialCommandPipelineService#cancelAllCommands} とは別。
   */
  cancelPrevious?: boolean;
}

interface CommandQueueState {
  generation: number;
  pendingCount: number;
  nextSlotId: number;
  rejectPendingSlotsBelow: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class SerialCommandPipelineService {
  private static readonly READ_BUFFER_CAP = 96_000;

  private readBuffer = '';
  private rxSubscription: Subscription | null = null;
  private readonly bufferNotify$ = new Subject<void>();

  private readonly executionQueue$ = new Subject<Observable<unknown>>();
  private readonly state: CommandQueueState = {
    generation: 0,
    pendingCount: 0,
    nextSlotId: 0,
    rejectPendingSlotsBelow: null,
  };

  constructor(
    private readonly transport: SerialTransportService,
    private readonly promptDetector: SerialPromptDetectorService,
  ) {
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

  startReadLoop(): void {
    this.readBuffer = '';
    this.rxSubscription?.unsubscribe();
    this.rxSubscription = this.transport.receive$.subscribe({
      next: (chunk) => {
        const piece = stripSerialAnsiForPrompt(chunk ?? '');
        this.readBuffer += piece;
        if (this.readBuffer.length > SerialCommandPipelineService.READ_BUFFER_CAP) {
          this.readBuffer = this.readBuffer.slice(
            -SerialCommandPipelineService.READ_BUFFER_CAP,
          );
        }
        this.bufferNotify$.next();
      },
      error: (err: unknown) => console.error('Serial receive stream error:', err),
    });
  }

  stopReadLoop(): void {
    this.rxSubscription?.unsubscribe();
    this.rxSubscription = null;
    this.readBuffer = '';
  }

  isReading(): boolean {
    return (
      this.rxSubscription != null &&
      !this.rxSubscription.closed
    );
  }

  /**
   * キュー経由で exec パイプラインを実行する実装入口。
   *
   * 呼び出し側の方針・ターミナル UI での禁止事項は {@link import('../serial-facade.service').SerialFacadeService#exec$} の JSDoc を参照（#616）。
   */
  exec$(
    cmd: string,
    options: SerialExecOptions,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    return this.enqueueExec$(cmd + '\n', options, onAttemptStart);
  }

  /** @see {@link import('../serial-facade.service').SerialFacadeService#execRaw$} */
  execRaw$(
    cmdRaw: string,
    options: SerialExecOptions,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    return this.enqueueExec$(cmdRaw, options, onAttemptStart);
  }

  /** @see {@link import('../serial-facade.service').SerialFacadeService#readUntilPrompt$} */
  readUntilPrompt$(
    options: SerialExecOptions,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    const merged = mergeSerialExecOptions(options);
    const config = this.serialOptionsToConfigInternal(merged);
    return this.enqueueCommand$(
      (enqueuedGen) =>
        this.buildReadUntilPromptPipelineInternal$(
          config,
          enqueuedGen,
          onAttemptStart,
        ),
      { cancelPrevious: merged.cancelPrevious },
    );
  }

  cancelAllCommands(): void {
    this.state.generation++;
    this.state.rejectPendingSlotsBelow = null;
    this.bufferNotify$.next();
  }

  getPendingCommandCount(): number {
    return this.state.pendingCount;
  }

  private enqueueExec$(
    payload: string,
    options: SerialExecOptions,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    const merged = mergeSerialExecOptions(options);
    const config = this.serialOptionsToConfigInternal(merged);
    return this.enqueueCommand$(
      (enqueuedGen) =>
        this.buildExecPipelineInternal$(
          payload,
          config,
          enqueuedGen,
          onAttemptStart,
        ),
      { cancelPrevious: merged.cancelPrevious },
    );
  }

  private invalidatePendingEnqueues(): void {
    this.state.rejectPendingSlotsBelow = this.state.nextSlotId + 1;
  }

  /**
   * enqueue 時点の世代がまだ有効か（`cancelAllCommands` されていなければ true）。
   */
  isGenerationActive(enqueuedGen: number): boolean {
    return this.state.generation === enqueuedGen;
  }

  /**
   * 直列キューへ Observable ファクトリを載せる。`exec$` / `readUntilPrompt$` 内部で使用する。
   */
  enqueueCommand$<T>(
    factory: (enqueuedGen: number) => Observable<T>,
    opts?: SerialCommandEnqueueOptions,
  ): Observable<T> {
    return new Observable<T>((subscriber) => {
      if (opts?.cancelPrevious) {
        this.invalidatePendingEnqueues();
      }
      const assignedSlotId = ++this.state.nextSlotId;
      const enqueuedGen = this.state.generation;
      this.state.pendingCount++;
      this.executionQueue$.next(
        this.createQueuedWork$(
          enqueuedGen,
          assignedSlotId,
          factory,
          subscriber,
        ),
      );
    });
  }

  private createQueuedWork$<T>(
    enqueuedGen: number,
    assignedSlotId: number,
    factory: (enqueuedGen: number) => Observable<T>,
    subscriber: Subscriber<T>,
  ): Observable<unknown> {
    return defer(() => {
      if (this.state.generation !== enqueuedGen) {
        return throwError(() => new Error('All commands cancelled'));
      }
      if (
        this.state.rejectPendingSlotsBelow !== null &&
        assignedSlotId < this.state.rejectPendingSlotsBelow
      ) {
        return throwError(() => new Error('All commands cancelled'));
      }
      return factory(enqueuedGen);
    }).pipe(
      finalize(() => {
        this.state.pendingCount--;
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
    );
  }

  private clearReadBuffer(): void {
    this.readBuffer = '';
  }

  private normalizeInspectionBufferText(s: string): string {
    return collapseCarriageRedrawsPerLine(s);
  }

  private promptInspectionBuffer(): string {
    return this.normalizeInspectionBufferText(this.readBuffer);
  }

  private waitForPromptMatch$(
    config: CommandExecutionConfig,
    enqueuedGen: number,
  ): Observable<string> {
    return this.bufferNotify$.pipe(
      startWith(undefined),
      map(() => {
        if (!this.isGenerationActive(enqueuedGen)) {
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

  private withPromptAttemptRetries<T>(
    attempt$: Observable<T>,
    retryCount: number,
  ): Observable<T> {
    return attempt$.pipe(retry({ count: retryCount }));
  }

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

  private buildExecPipelineInternal$(
    sendData: string,
    config: CommandExecutionConfig,
    enqueuedGen: number,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    const retryCount = config.retry ?? 0;
    const attempt$ = defer(() => {
      if (!this.isGenerationActive(enqueuedGen)) {
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

  private buildReadUntilPromptPipelineInternal$(
    config: CommandExecutionConfig,
    enqueuedGen: number,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    const retryCount = config.retry ?? 0;
    const attempt$ = defer(() => {
      if (!this.isGenerationActive(enqueuedGen)) {
        return throwError(() => new Error('All commands cancelled'));
      }
      onAttemptStart?.();
      return this.readUntilPromptOutcome$(config, enqueuedGen);
    });
    return this.withPromptAttemptRetries(attempt$, retryCount);
  }

  private serialOptionsToConfigInternal(
    options: SerialExecOptions,
  ): CommandExecutionConfig {
    const m = mergeSerialExecOptions(options);
    const { prompt, promptMatch, waitForPrompt } = m;
    const timeoutMs = m.timeout ?? DEFAULT_SERIAL_EXEC_OPTIONS.timeout;
    const retry = m.retry ?? DEFAULT_SERIAL_EXEC_OPTIONS.retry;
    if (promptMatch === undefined && prompt === undefined) {
      throw new Error('SerialExecOptions: prompt or promptMatch is required');
    }
    return {
      prompt: prompt ?? '',
      promptMatch,
      timeout: timeoutMs,
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
