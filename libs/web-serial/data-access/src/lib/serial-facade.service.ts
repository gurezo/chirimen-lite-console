/// <reference types="@types/w3c-web-serial" />

/** Full rewrite (#606). Facade over `SerialSession` v2.3.1 via {@link SerialTransportService}. */
import { Injectable, inject } from '@angular/core';
import { type Observable, take } from 'rxjs';
import {
  type CommandResult,
  SerialCommandService,
} from './serial-command/serial-command-facade.service';
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
 * アプリ唯一の入口。`@gurezo/web-serial-rxjs` v2.3.1 の {@link SerialSession} 由来は
 * {@link SerialTransportService} が `isBrowserSupported` / `connect$` / `disconnect$` /
 * `isConnected$` / `terminalText$` / `lines$` / `errors$` で橋渡しする。
 * 生の受信チャンク（`receive$`）は {@link SerialTransportService} 内および
 * {@link SerialCommandRunnerService} のみが利用する（Issue #649）。
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

  /** {@link SerialTransportService.isBrowserSupported} */
  isBrowserSupported(): boolean {
    return this.transport.isBrowserSupported();
  }

  readonly errors$ = this.transport.errors$;
  readonly portInfo$ = this.transport.portInfo$;
  readonly lines$ = this.transport.lines$;

  /**
   * ターミナル（xterm 等）の **ライブ表示専用** テキストストリーム（[#617](https://github.com/gurezo/chirimen-lite-console/issues/617)）。
   *
   * - **ターミナル UI は本 Observable を購読**し、シェルからの出力を画面に反映する。TTY の `\r` 再描画の畳み込み等はライブラリの `SerialSession.terminalText$` に委譲する。
   * - **送信**は {@link #send$} のみとし、表示の更新に {@link #exec$} / {@link #execRaw$} / {@link #readUntilPrompt$} の戻り値を用いない（二重表示・責務の混乱を避ける。キャプチャ用途は {@link #exec$} 側のドキュメント参照）。
   * - **プロンプト検出・ログイン判定**には本ストリームは使わない。同期は {@link #readUntilPrompt$} / {@link #exec$} 等に任せ、バッファは data-access 内で {@link SerialTransportService#receive$} から構築される。
   *
   * @see {@link #exec$} ターミナル UI では exec 系を呼ばない理由と内部向け利用境界
   */
  readonly terminalText$ = this.transport.terminalText$;

  connect$(baudRate = 115200): Observable<SerialFacadeConnectResult> {
    return this.connection.connect$(baudRate);
  }

  disconnect$(): Observable<void> {
    return this.connection.disconnect$();
  }

  /**
   * ターミナル対話のユーザー入力をそのまま送るための送信 API（Issue #625）。
   *
   * - 主用途はキーボード入力・ツールバー送信などの UI 由来入力。
   * - 本メソッドは送信のみを担い、コマンド完了待ちや結果解析は行わない。
   * - 完了待ち・stdout 解析が必要なアプリ制御フローは {@link #exec$} を使う。
   */
  send$(data: string): Observable<void> {
    return this.transport.send$(data);
  }

  read$(): Observable<string> {
    return this.lines$.pipe(take(1));
  }

  /**
   * プロンプト同期でコマンドを送り、シェルが戻るまでの **stdout 等のキャプチャ結果** を返す。
   *
   * **利用境界（[#616](https://github.com/gurezo/chirimen-lite-console/issues/616)）**
   * - **ターミナル UI（xterm の対話・ツールバー送信）では呼ばない。** 表示は {@link #terminalText$}、送信は {@link #send$} に統一する（親 [#609](https://github.com/gurezo/chirimen-lite-console/issues/609)）。
   * - **アプリ内部**で「コマンド完了まで待ち、stdout を取りたい」フロー向け。代表例はログイン後 bootstrap、i2cdetect、Chirimen setup など。Wi-Fi・ファイルマネージャ・リモート等、プロンプト待ちが必要な機能も同じ層に含める。
   * - とくに接続後初期化（ログイン後の環境設定）は、成功/失敗を判定して呼び出し元へ返す必要があるため `exec$` を使う（Issue #625）。
   *
   * {@link SerialCommandService#exec$} に委譲する。
   */
  exec$(
    cmd: string,
    options: SerialExecOptions,
  ): Observable<CommandResult> {
    return this.command.exec$(cmd, options);
  }

  /**
   * {@link #exec$} と同様の責務で、ペイロード末尾に改行を付けない Raw 送信が必要な場合に用いる。
   *
   * @see {@link #exec$} 利用境界（ターミナル UI 禁止）
   */
  execRaw$(
    cmdRaw: string,
    options: SerialExecOptions,
  ): Observable<CommandResult> {
    return this.command.execRaw$(cmdRaw, options);
  }

  /**
   * コマンド送信なしでプロンプト出現まで待ち、それまでのバッファを {@link CommandResult} として返す。
   *
   * @see {@link #exec$} 利用境界（ターミナル UI 禁止・アプリ内部のプロンプト同期用）
   */
  readUntilPrompt$(options: SerialExecOptions): Observable<CommandResult> {
    return this.command.readUntilPrompt$(options);
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
