/// <reference types="@types/w3c-web-serial" />

import { Injectable, inject } from '@angular/core';
import type { SerialError } from '@gurezo/web-serial-rxjs';
import {
  catchError,
  defer,
  of,
  type Observable,
  Subject,
  switchMap,
  take,
  throwError,
} from 'rxjs';
import {
  type CommandResult,
  SerialCommandService,
} from './serial-command.service';
import {
  getConnectionErrorMessage,
  SERIAL_TIMEOUT,
  type SerialExecOptions,
} from '@libs-web-serial-util';
import { PiZeroShellReadinessService } from './pi-zero-shell-readiness.service';
import { SerialTransportService } from './serial-transport.service';
import { SerialValidatorService } from './serial-validator.service';

/** {@link SerialFacadeService#connect$} の結果 */
export type SerialFacadeConnectResult =
  | { ok: true }
  | { ok: false; errorMessage: string };

/**
 * Serial Facade サービス
 *
 * Transport / Validator（ポート情報） / Command を統合し、シンプルな API を提供
 */
@Injectable({
  providedIn: 'root',
})
export class SerialFacadeService {
  private transport = inject(SerialTransportService);
  private command = inject(SerialCommandService);
  private validator = inject(SerialValidatorService);
  private shellReadiness = inject(PiZeroShellReadinessService);

  /** 接続成功のたびに増加（同一接続の post-connect 処理を1回に制限するため） */
  private connectionEpoch = 0;

  private readonly connectionEstablished = new Subject<void>();
  /**
   * シリアル接続が確立されるたびに通知（ターミナルが後からマウントされる場合のブートストラップ用）
   * {@link SerialTransportService.state$} が `connected` になる回と同期。
   */
  readonly connectionEstablished$ = this.connectionEstablished.asObservable();

  /** ライブラリ `SerialSession.state$` の橋渡し（未接続は `idle`） */
  readonly state$ = this.transport.state$;
  /** ライブラリ `SerialSession.isConnected$` の橋渡し */
  readonly isConnected$ = this.transport.isConnected$;
  /** ライブラリ主エラーチャネル（未接続時は購読しても何も来ない） */
  get errors$(): Observable<SerialError> {
    return this.transport.errors$;
  }
  get portInfo$(): Observable<SerialPortInfo | null> {
    return this.transport.portInfo$;
  }

  /**
   * データストリーム (Observable)
   * 未接続時は購読時にエラーとなる（{@link SerialTransportService#getReadStream}）。
   */
  get data$() {
    return this.transport.getReadStream();
  }

  /**
   * Serial ポートに接続（Observable）
   *
   * @param baudRate ボーレート (デフォルト: 115200)
   */
  connect$(baudRate = 115200): Observable<SerialFacadeConnectResult> {
    return defer(() =>
      this.transport.isConnected$.pipe(
        take(1),
        switchMap((connected) =>
          connected ? this.disconnect$() : of(undefined)
        ),
        switchMap(() => this.transport.connect$(baudRate)),
        switchMap((result) => {
          if ('error' in result) {
            console.error('Connection failed:', result.error);
            return of<SerialFacadeConnectResult>({
              ok: false,
              errorMessage: result.error,
            });
          }
          this.startReadStreamSubscription();
          this.connectionEpoch += 1;
          this.shellReadiness.reset();
          this.connectionEstablished.next();
          return of<SerialFacadeConnectResult>({ ok: true });
        }),
        catchError((error: unknown) => {
          console.error('Connection error:', error);
          return of<SerialFacadeConnectResult>({
            ok: false,
            errorMessage: getConnectionErrorMessage(error),
          });
        })
      )
    );
  }

  private startReadStreamSubscription(): void {
    this.command.startReadLoop();
  }

  /**
   * Serial ポートから切断（Observable）
   */
  disconnect$(): Observable<void> {
    this.shellReadiness.reset();
    this.command.cancelAllCommands();
    this.command.stopReadLoop();
    return this.transport.disconnect$().pipe(
      catchError((error) => {
        console.error('Disconnect error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * データを書き込む（Observable）
   */
  write$(data: string): Observable<void> {
    return this.transport.write(data);
  }

  /**
   * 1 チャンクだけ読み取る（Observable）
   */
  read$(): Observable<string> {
    return this.transport.getReadStream().pipe(take(1));
  }

  /**
   * コマンド実行（stdout 相当を返す）
   */
  exec$(
    cmd: string,
    options: SerialExecOptions,
  ): Observable<CommandResult> {
    const {
      prompt,
      timeout = SERIAL_TIMEOUT.DEFAULT,
      retry = 0,
    } = options;
    return this.command.exec$(cmd, { prompt, timeout, retry });
  }

  /**
   * raw コマンド実行（改行制御が必要なケース向け）
   */
  execRaw$(
    cmdRaw: string,
    options: SerialExecOptions,
  ): Observable<CommandResult> {
    const {
      prompt,
      timeout = SERIAL_TIMEOUT.DEFAULT,
      retry = 0,
    } = options;
    return this.command.execRaw$(cmdRaw, { prompt, timeout, retry });
  }

  /**
   * 送信せずに prompt まで待機
   */
  readUntilPrompt$(options: SerialExecOptions): Observable<CommandResult> {
    const {
      prompt,
      timeout = SERIAL_TIMEOUT.DEFAULT,
      retry = 0,
    } = options;
    return this.command.readUntilPrompt$({ prompt, timeout, retry });
  }

  /** 現在のシリアル接続セッション番号（切断後も値は保持され、次回接続で増える） */
  getConnectionEpoch(): number {
    return this.connectionEpoch;
  }

  /**
   * 読み取り中かどうか（ストリーム購読中は true）
   */
  isReading(): boolean {
    return this.command.isReading();
  }

  getPendingCommandCount(): number {
    return this.command.getPendingCommandCount();
  }

  async isRaspberryPiZero(): Promise<boolean> {
    const syncInfo = this.transport.getPortInfo();
    if (this.validator.isPiZeroPortInfo(syncInfo)) {
      return true;
    }
    const port = this.transport.getPort();
    if (!port) {
      return false;
    }
    return this.validator.isRaspberryPiZero(port);
  }

  getPort(): SerialPort | null {
    return this.transport.getPort() ?? null;
  }
}
