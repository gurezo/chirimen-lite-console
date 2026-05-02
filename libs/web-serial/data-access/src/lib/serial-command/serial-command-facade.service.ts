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
   * 接続後に呼び出し、{@link SerialTransportService#lines$} を購読する（runner のプロンプト／exec バッファ用）。
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
  exec$(
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

  execRaw$(
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
}
