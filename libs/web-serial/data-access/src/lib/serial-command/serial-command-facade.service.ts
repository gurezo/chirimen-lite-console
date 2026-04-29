/// <reference types="@types/w3c-web-serial" />

import { Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import {
  mergeSerialExecOptions,
  type SerialExecOptions,
} from '@libs-web-serial-util';
import type { CommandExecutionConfig, CommandResult } from './serial-command-types';
import { SerialCommandQueueService } from './serial-command-queue.service';
import { SerialCommandRunnerService } from './serial-command-runner.service';

export type {
  CommandExecutionConfig,
  CommandResult,
} from './serial-command-types';

/**
 * Serial 上のコマンド実行の公開 API と facade。
 * 送信・待機は {@link SerialCommandRunnerService}、直列・キャンセルは {@link SerialCommandQueueService}。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialCommandService {
  constructor(
    private readonly runner: SerialCommandRunnerService,
    private readonly commandQueue: SerialCommandQueueService,
  ) {}

  /**
   * 接続後に呼び出し、`lines$` 経路だけを購読する。
   */
  startReadLoop(): void {
    this.runner.startReadLoop();
  }

  /** 読み取り購読を停止しバッファを空にする */
  stopReadLoop(): void {
    this.runner.stopReadLoop();
  }

  /** 読み取りストリームを購読中か */
  isReading(): boolean {
    return this.runner.isReading();
  }

  /**
   * {@link SerialExecOptions}（既定のタイムアウト・再試行・フラグあり）でコマンド実行
   */
  execWithSerialOptions$(
    cmd: string,
    options: SerialExecOptions,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    const merged = mergeSerialExecOptions(options);
    const config = this.runner.serialOptionsToConfig(merged);
    return this.commandQueue.enqueueCommand$(
      (enqueuedGen) =>
        this.runner.buildExecPipeline$(
          cmd + '\n',
          config,
          enqueuedGen,
          onAttemptStart,
        ),
      { cancelPrevious: merged.cancelPrevious },
    );
  }

  execRawWithSerialOptions$(
    cmdRaw: string,
    options: SerialExecOptions,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    const merged = mergeSerialExecOptions(options);
    const config = this.runner.serialOptionsToConfig(merged);
    return this.commandQueue.enqueueCommand$(
      (enqueuedGen) =>
        this.runner.buildExecPipeline$(
          cmdRaw,
          config,
          enqueuedGen,
          onAttemptStart,
        ),
      { cancelPrevious: merged.cancelPrevious },
    );
  }

  readUntilPromptWithSerialOptions$(
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

  /**
   * コマンド実行（stdin に `cmd + '\n'` を送信し、prompt まで待機）
   */
  exec$(
    cmd: string,
    config: CommandExecutionConfig,
    onAttemptStart?: () => void,
  ): Observable<CommandResult> {
    return this.commandQueue.enqueueCommand$((enqueuedGen) =>
      this.runner.buildExecPipeline$(
        cmd + '\n',
        config,
        enqueuedGen,
        onAttemptStart,
      ),
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
      this.runner.buildExecPipeline$(
        cmdRaw,
        config,
        enqueuedGen,
        onAttemptStart,
      ),
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
      this.runner.buildReadUntilPromptPipeline$(
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
