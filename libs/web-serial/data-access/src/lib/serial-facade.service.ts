/// <reference types="@types/w3c-web-serial" />

import { Injectable, inject } from '@angular/core';
import type { SerialError } from '@gurezo/web-serial-rxjs';
import { type Observable, take } from 'rxjs';
import {
  type CommandResult,
  SerialCommandService,
} from './serial-command.service';
import {
  type SerialConnectResult,
  SerialConnectionOrchestrationService,
} from './serial-connection-orchestration.service';
import {
  type SerialExecOptions,
} from '@libs-web-serial-util';
import { SerialTransportService } from './serial-transport.service';
import { SerialValidatorService } from './serial-validator.service';

/** {@link SerialFacadeService#connect$} の結果（後方互換の別名） */
export type SerialFacadeConnectResult = SerialConnectResult;

/**
 * Serial Facade サービス
 *
 * Transport / Validator / Command / 接続オーケストレーションを束ね、アプリ向け API を提供する薄い層。
 *
 * ### 受信ストリーム（issue #559, #566）
 *
 * 各ストリームの意味は {@link SerialTransportService} のクラスドキュメントおよび `libs/web-serial/data-access/README.md` を参照。
 *
 * - {@link #terminalOutput$} … ターミナル表示専用。replay 付き **生** 受信（= {@link #receiveReplay$}）。
 * - {@link #commandResultLines$} / {@link #data$} / {@link #read$} … コマンド実行・プロンプト待ち用の **行**（multicast）。
 * - {@link #lines$} … `SerialSession.lines$` の素の橋渡し（未接続時 `NEVER`）。
 * - {@link #receive$} … 生チャンク（replay なし）。
 * - {@link #receiveReplay$} … {@link #terminalOutput$} と同一の replay 付き生受信。
 *
 * プロンプト待ち・`exec$` は {@link SerialCommandService} が {@link SerialTransportService#receive$} を累積したバッファで照合する（`lines$` は使用しない）。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialFacadeService {
  private transport = inject(SerialTransportService);
  private command = inject(SerialCommandService);
  private validator = inject(SerialValidatorService);
  private connection = inject(SerialConnectionOrchestrationService);

  readonly connectionEstablished$ = this.connection.connectionEstablished$;

  readonly state$ = this.transport.state$;
  readonly isConnected$ = this.transport.isConnected$;
  get errors$(): Observable<SerialError> {
    return this.transport.errors$;
  }
  get portInfo$(): Observable<SerialPortInfo | null> {
    return this.transport.portInfo$;
  }

  /** 行単位の受信。未接続時は完了しないストリーム（NEVER）。 */
  get lines$(): Observable<string> {
    return this.transport.lines$;
  }

  /**
   * ターミナル UI 向けの受信ログ（issue #566 の `terminalOutput$`）。
   * 生チャンク・replay 付き。プロンプト判定には使わないこと。
   */
  get terminalOutput$(): Observable<string> {
    return this.transport.receiveReplay$;
  }

  /**
   * コマンド実行・プロンプト待ち向けの行ストリーム（issue #566 の `commandResult$` 相当の入力）。
   * multicast。表示用 {@link #terminalOutput$} とは別経路。
   */
  get commandResultLines$(): Observable<string> {
    return this.transport.commandResultLines$;
  }

  /** 生の受信チャンク。 */
  get receive$(): Observable<string> {
    return this.transport.receive$;
  }

  /** replay 付き生受信。{@link #terminalOutput$} と同一源。 */
  get receiveReplay$(): Observable<string> {
    return this.transport.receiveReplay$;
  }

  /**
   * 接続済み時のみ 1 行ずつ読むストリーム（{@link SerialTransportService#getReadStream} = {@link #commandResultLines$}）。
   * 未接続で購読するとエラー。
   */
  get data$() {
    return this.transport.getReadStream();
  }

  connect$(baudRate = 115200): Observable<SerialFacadeConnectResult> {
    return this.connection.connect$(baudRate);
  }

  disconnect$(): Observable<void> {
    return this.connection.disconnect$();
  }

  write$(data: string): Observable<void> {
    return this.transport.write(data);
  }

  read$(): Observable<string> {
    return this.transport.getReadStream().pipe(take(1));
  }

  exec$(
    cmd: string,
    options: SerialExecOptions,
  ): Observable<CommandResult> {
    return this.command.execWithSerialOptions$(cmd, options);
  }

  execRaw$(
    cmdRaw: string,
    options: SerialExecOptions,
  ): Observable<CommandResult> {
    return this.command.execRawWithSerialOptions$(cmdRaw, options);
  }

  readUntilPrompt$(options: SerialExecOptions): Observable<CommandResult> {
    return this.command.readUntilPromptWithSerialOptions$(options);
  }

  getConnectionEpoch(): number {
    return this.connection.getConnectionEpoch();
  }

  isReading(): boolean {
    return this.command.isReading();
  }

  getPendingCommandCount(): number {
    return this.command.getPendingCommandCount();
  }

  isRaspberryPiZero(): Promise<boolean> {
    return this.validator.isRaspberryPiZeroSerialAccess(this.transport);
  }

  getPort(): SerialPort | null {
    return this.transport.getPort() ?? null;
  }
}
