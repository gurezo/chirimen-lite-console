/// <reference types="@types/w3c-web-serial" />

/** Facade over `SerialSession` v3.1.0 via {@link SerialTransportService}. */
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';
import type { CommandResult } from '../models';
import { SerialCommandPipelineService } from './serial-command/serial-command-pipeline.service';
import {
  type SerialConnectResult,
  SerialConnectionOrchestrationService,
} from './serial-connection-orchestration.service';
import {
  type SerialExecOptions,
} from '../functions';
import { SerialTransportService } from './serial-transport.service';

/** {@link SerialFacadeService#connect$} の結果（後方互換の別名） */
export type SerialFacadeConnectResult = SerialConnectResult;

/**
 * アプリ唯一の入口。`@gurezo/web-serial-rxjs` v3.1.0 の {@link SerialSession} 由来は
 * {@link SerialTransportService} が Signal で橋渡しする。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialFacadeService {
  private transport = inject(SerialTransportService);
  private command = inject(SerialCommandPipelineService);
  private connection = inject(SerialConnectionOrchestrationService);

  readonly state = this.transport.state;
  readonly isConnected = this.transport.isConnected;
  readonly errors = this.transport.errors;
  readonly portInfo = this.transport.portInfo;
  readonly lines = this.transport.lines;
  readonly terminalText = this.transport.terminalText;

  /** 成功したシリアル接続ごとに単調増加するセッション識別子。 */
  readonly connectionEpoch = this.connection.connectionEpoch;

  /** {@link SerialTransportService.isBrowserSupported} */
  isBrowserSupported(): boolean {
    return this.transport.isBrowserSupported();
  }

  connect$(baudRate = 115200): Observable<SerialFacadeConnectResult> {
    return this.connection.connect$(baudRate);
  }

  disconnect$(): Observable<void> {
    return this.connection.disconnect$();
  }

  /**
   * ターミナル対話のユーザー入力をそのまま送るための送信 API（Issue #625）。
   */
  send$(data: string): Observable<void> {
    return this.transport.send$(data);
  }

  /**
   * プロンプト同期でコマンドを送り、シェルが戻るまでの **stdout 等のキャプチャ結果** を返す。
   *
   * **利用境界（[#616](https://github.com/gurezo/chirimen-lite-console/issues/616)）**
   * - **ターミナル UI（xterm の対話・ツールバー送信）では呼ばない。** 表示は {@link #terminalText}、送信は {@link #send$} に統一する。
   * - **アプリ内部**で「コマンド完了まで待ち、stdout を取りたい」フロー向け。
   */
  exec$(
    cmd: string,
    options: SerialExecOptions,
  ): Observable<CommandResult> {
    return this.command.exec$(cmd, options);
  }

  execRaw$(
    cmdRaw: string,
    options: SerialExecOptions,
  ): Observable<CommandResult> {
    return this.command.execRaw$(cmdRaw, options);
  }

  readUntilPrompt$(options: SerialExecOptions): Observable<CommandResult> {
    return this.command.readUntilPrompt$(options);
  }

  isRaspberryPiZero(): Promise<boolean> {
    return this.transport.isRaspberryPiZero();
  }
}
