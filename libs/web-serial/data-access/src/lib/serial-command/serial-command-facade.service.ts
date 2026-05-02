/// <reference types="@types/w3c-web-serial" />

/** Full rewrite (#606). Command API; send path reaches `SerialSession` via transport. */
import { Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import {
  mergeSerialExecOptions,
  type SerialExecOptions,
} from '@libs-web-serial-util';
import type { CommandResult } from './serial-command-types';
import { SerialCommandQueueService } from './serial-command-queue.service';
import { SerialCommandRunnerService } from './serial-command-runner.service';

export type {
  CommandExecutionConfig,
  CommandResult,
} from './serial-command-types';

@Injectable({
  providedIn: 'root',
})
export class SerialCommandService {
  constructor(
    private readonly runner: SerialCommandRunnerService,
    private readonly commandQueue: SerialCommandQueueService,
  ) {}

  startReadLoop(): void {
    this.runner.startReadLoop();
  }

  stopReadLoop(): void {
    this.runner.stopReadLoop();
  }

  isReading(): boolean {
    return this.runner.isReading();
  }

  /**
   * キュー経由で exec パイプラインを実行する実装入口。
   *
   * 呼び出し側の方針・ターミナル UI での禁止事項は {@link SerialFacadeService#exec$} の JSDoc を参照（#616）。
   */
  exec$(
    cmd: string,
    options: SerialExecOptions,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    return this.enqueueExec$(cmd + '\n', options, onAttemptStart);
  }

  /** @see {@link SerialFacadeService#execRaw$} */
  execRaw$(
    cmdRaw: string,
    options: SerialExecOptions,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    return this.enqueueExec$(cmdRaw, options, onAttemptStart);
  }

  /** @see {@link SerialFacadeService#readUntilPrompt$} */
  readUntilPrompt$(
    options: SerialExecOptions,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    const merged = mergeSerialExecOptions(options);
    const config = this.runner.serialOptionsToConfig(merged);
    return this.commandQueue.enqueueCommand$(
      (enqueuedGen) =>
        this.runner.buildReadUntilPromptPipeline$(
          config,
          enqueuedGen,
          onAttemptStart,
        ),
      { cancelPrevious: merged.cancelPrevious },
    );
  }

  cancelAllCommands(): void {
    this.commandQueue.cancelAllCommands();
  }

  getPendingCommandCount(): number {
    return this.commandQueue.getPendingCommandCount();
  }

  private enqueueExec$(
    payload: string,
    options: SerialExecOptions,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    const merged = mergeSerialExecOptions(options);
    const config = this.runner.serialOptionsToConfig(merged);
    return this.commandQueue.enqueueCommand$(
      (enqueuedGen) =>
        this.runner.buildExecPipeline$(
          payload,
          config,
          enqueuedGen,
          onAttemptStart,
        ),
      { cancelPrevious: merged.cancelPrevious },
    );
  }
}
