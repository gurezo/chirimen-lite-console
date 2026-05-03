/// <reference types="@types/w3c-web-serial" />

import { Injectable } from '@angular/core';
import {
  createSerialSession,
  SerialError,
  SerialSessionState,
  type SerialSession,
} from '@gurezo/web-serial-rxjs';
import {
  BehaviorSubject,
  Observable,
  catchError,
  concat,
  defaultIfEmpty,
  defer,
  distinctUntilChanged,
  EMPTY,
  NEVER,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import {
  getConnectionErrorMessage,
  getWriteErrorMessage,
  RASPBERRY_PI_ZERO_INFO,
} from '@libs-web-serial-util';

/**
 * Angular 向けの薄いアダプタ。実体は常に `@gurezo/web-serial-rxjs` v2.3.1 の {@link SerialSession} 1 個。
 *
 * アプリは未接続時でも次をそのまま購読できる（接続後はライブラリの Observable に切り替わる）。
 * - {@link SerialSession.isBrowserSupported} … {@link #isBrowserSupported}
 * - {@link SerialSession.connect$} / {@link SerialSession.disconnect$} … {@link #connect$} / {@link #disconnect$}
 * - {@link SerialSession.isConnected$} … {@link #isConnected$}
 * - {@link SerialSession.terminalText$} … {@link #terminalText$}
 * - {@link SerialSession.lines$} … {@link #lines$}
 * - {@link SerialSession.receive$} … {@link #receive$}（`SerialCommandPipelineService` がプロンプト照合に利用）
 * - {@link SerialSession.errors$} … {@link #errors$}
 *
 * `state$` / `portInfo$` / `send$` は接続オーケストレーション・機種判定のため引き続き公開する。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialTransportService {
  private active: SerialSession | undefined;

  private readonly activeSession$ = new BehaviorSubject<
    SerialSession | undefined
  >(undefined);

  /** {@link SerialSession.isBrowserSupported}（ポート未生成でも利用可） */
  isBrowserSupported(): boolean {
    return createSerialSession().isBrowserSupported();
  }

  /**
   * 接続中は `from(session)`、未接続時は `whenIdle` を流す。
   * ライブラリが multicast なストリームをそのまま橋渡しする。
   */
  private fromSession<T>(
    from: (session: SerialSession) => Observable<T>,
    whenIdle: Observable<T>,
  ): Observable<T> {
    return this.activeSession$.pipe(
      switchMap((session) => (session ? from(session) : whenIdle)),
    );
  }

  readonly state$ = this.fromSession(
    (s) => s.state$,
    concat(of(SerialSessionState.Idle), NEVER),
  ).pipe(distinctUntilChanged());

  /** {@link SerialSession.isConnected$} */
  readonly isConnected$ = this.fromSession(
    (s) => s.isConnected$,
    concat(of(false), NEVER),
  ).pipe(distinctUntilChanged());

  /** {@link SerialSession.lines$} */
  readonly lines$ = this.fromSession((s) => s.lines$, NEVER);

  /**
   * {@link SerialSession.receive$}（UTF-8 デコード済みの生チャンク）。
   * getty が行末を lone `\r` のみにすると {@link #lines$} では行が emit されないことがあるため、
   * プロンプト待ちは {@link import('./serial-command/serial-command-pipeline.service').SerialCommandPipelineService} がこちらを購読する。
   */
  readonly receive$ = this.fromSession((s) => s.receive$, NEVER);

  /**
   * {@link SerialSession.terminalText$}。ターミナル UI のライブ表示用（TTY 再描画の畳み込みはライブラリ側）。
   * 利用境界は {@link SerialFacadeService#terminalText$} の JSDoc および data-access README（[#617](https://github.com/gurezo/chirimen-lite-console/issues/617)）を参照。
   */
  readonly terminalText$ = this.fromSession((s) => s.terminalText$, NEVER);

  /** {@link SerialSession.errors$} */
  get errors$(): Observable<SerialError> {
    return this.fromSession((s) => s.errors$ ?? EMPTY, EMPTY);
  }

  readonly portInfo$ = this.fromSession((s) => s.portInfo$ ?? of(null), of(null));

  getPortInfo(): SerialPortInfo | null {
    return this.active?.getPortInfo() ?? null;
  }

  /**
   * {@link SerialSession.connect$} を呼び出し、Pi Zero フィルタでポートを開く。
   * 戻り値だけアプリ向けに `{ port } | { error }` に整形する。
   */
  connect$(
    baudRate = 115200,
  ): Observable<{ port: SerialPort } | { error: string }> {
    return defer(() => {
      this.detachSession();
      const session = createSerialSession({
        baudRate,
        filters: [
          {
            usbVendorId: RASPBERRY_PI_ZERO_INFO.usbVendorId,
            usbProductId: RASPBERRY_PI_ZERO_INFO.usbProductId,
          },
        ],
      });
      this.active = session;
      this.activeSession$.next(session);
      return session.connect$().pipe(
        switchMap(() => {
          const port = session.getCurrentPort();
          if (!port) {
            this.detachSession();
            return of({
              error: getConnectionErrorMessage(
                new Error('Port is not available after connection'),
              ),
            });
          }
          return of({ port });
        }),
        catchError((error) => {
          this.detachSession();
          return of({ error: getConnectionErrorMessage(error) });
        }),
      );
    });
  }

  /** {@link SerialSession.disconnect$} */
  disconnect$(): Observable<void> {
    return defer(() => {
      if (!this.active) {
        return of(undefined);
      }
      const snapshot = this.active;
      return snapshot.disconnect$().pipe(
        defaultIfEmpty(undefined),
        tap(() => {
          if (this.active === snapshot) {
            this.detachSession();
          }
        }),
        catchError((error) => {
          console.error('Error closing port:', error);
          return throwError(() => error);
        }),
      );
    });
  }

  getPort(): SerialPort | undefined {
    return this.active?.getCurrentPort() ?? undefined;
  }

  /** {@link SerialSession.send$} */
  send$(data: string): Observable<void> {
    return defer(() => {
      const s = this.active;
      if (!s) {
        return throwError(() => new Error('Serial port not connected'));
      }
      return s.send$(data).pipe(
        catchError((error) =>
          throwError(() => new Error(getWriteErrorMessage(error))),
        ),
      );
    });
  }

  private detachSession(): void {
    this.active = undefined;
    this.activeSession$.next(undefined);
  }
}
