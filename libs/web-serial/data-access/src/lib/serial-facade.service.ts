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
 * - {@link #terminalText$} … ターミナル表示専用。terminal helper で整形済み文字列。
 * - {@link #read$} … 接続済み時の 1 行受信。
 * - {@link #lines$} … `SerialSession.lines$` の素の橋渡し（未接続時 `NEVER`）。
 * - {@link #receive$} … 生チャンク（replay なし）。
 * - {@link #receiveReplay$} … 後方互換の replay 付き生受信。
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

  /** ターミナル UI 向けの表示テキスト。terminal helper による整形済み文字列。 */
  get terminalText$(): Observable<string> {
    return this.transport.terminalText$;
  }

  /**
   * @deprecated `terminalText$` を使用すること。
   * 互換性のため残すが、replay 生受信ではなく表示テキストに委譲する。
   */
  get terminalOutput$(): Observable<string> {
    return this.terminalText$;
  }

  /** 生の受信チャンク。 */
  get receive$(): Observable<string> {
    return this.transport.receive$;
  }

  /** replay 付き生受信（後方互換用途）。 */
  get receiveReplay$(): Observable<string> {
    return this.transport.receiveReplay$;
  }

  connect$(baudRate = 115200): Observable<SerialFacadeConnectResult> {
    return this.connection.connect$(baudRate);
  }

  disconnect$(): Observable<void> {
    return this.connection.disconnect$();
  }

  send$(data: string): Observable<void> {
    return this.transport.send$(data);
  }

  /** @deprecated `send$` を使用すること。 */
  write$(data: string): Observable<void> {
    return this.send$(data);
  }

  read$(): Observable<string> {
    return this.lines$.pipe(take(1));
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
