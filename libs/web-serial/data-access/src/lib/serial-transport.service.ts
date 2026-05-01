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
  catchError,
  concat,
  defaultIfEmpty,
  defer,
  distinctUntilChanged,
  EMPTY,
  NEVER,
  Observable,
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

/** SerialSession を薄く公開する transport。 */
@Injectable({
  providedIn: 'root',
})
export class SerialTransportService {
  private session: SerialSession | undefined;

  /**
   * 現在アクティブな {@link SerialSession}（接続試行前の失敗時は undefined）。
   * state のミラーではなく、ストリームの `switchMap` 元のみ。
   */
  private readonly activeSession$ = new BehaviorSubject<
    SerialSession | undefined
  >(undefined);

  /**
   * 接続中は `pick(session)`、未接続時は `whenDisconnected` を購読する。
   */
  private sessionSwitchMap<T>(
    pick: (s: SerialSession) => Observable<T>,
    whenDisconnected: Observable<T>,
  ): Observable<T> {
    return this.activeSession$.pipe(
      switchMap((s) => (s ? pick(s) : whenDisconnected)),
    );
  }

  /** ライブラリ {@link SerialSession.state$}。未接続時は `idle` を継続発火。 */
  readonly state$ = this.sessionSwitchMap(
    (s) => s.state$,
    concat(of(SerialSessionState.Idle), NEVER),
  ).pipe(distinctUntilChanged());

  /** ライブラリ {@link SerialSession.isConnected$}。未接続時は `false` を継続。 */
  readonly isConnected$ = this.sessionSwitchMap(
    (s) => s.isConnected$,
    concat(of(false), NEVER),
  ).pipe(distinctUntilChanged());

  /**
   * ライブラリ {@link SerialSession.lines$}。未接続時は無限に完了しない空ストリーム。
   */
  readonly lines$ = this.sessionSwitchMap((s) => s.lines$, NEVER);

  /** terminal helper で整形済みの表示向けテキスト。 */
  readonly terminalText$ = this.sessionSwitchMap(
    (s) => s.terminalText$,
    NEVER,
  );

  /**
   * I/O エラー（`SerialError`）のライブラリ本流。未接続時は空ストリーム。
   */
  get errors$(): Observable<SerialError> {
    return this.sessionSwitchMap((s) => s.errors$ ?? EMPTY, EMPTY);
  }

  get portInfo$(): Observable<SerialPortInfo | null> {
    return this.sessionSwitchMap((s) => s.portInfo$ ?? of(null), of(null));
  }

  getPortInfo(): SerialPortInfo | null {
    return this.session?.getPortInfo() ?? null;
  }

  /**
   * Serial ポートに接続（Observable）
   * @param baudRate ボーレート (デフォルト: 115200)
   */
  connect$(
    baudRate = 115200,
  ): Observable<{ port: SerialPort } | { error: string }> {
    return defer(() => {
      this.tearDownSession();
      const session = createSerialSession({
        baudRate,
        filters: [
          {
            usbVendorId: RASPBERRY_PI_ZERO_INFO.usbVendorId,
            usbProductId: RASPBERRY_PI_ZERO_INFO.usbProductId,
          },
        ],
      });
      this.session = session;
      this.activeSession$.next(session);
      return session.connect$().pipe(
        switchMap(() => {
          const port = session.getCurrentPort();
          if (!port) {
            this.tearDownSession();
            return of({
              error: getConnectionErrorMessage(
                new Error('Port is not available after connection'),
              ),
            });
          }
          return of({ port });
        }),
        catchError((error) => {
          this.tearDownSession();
          return of({ error: getConnectionErrorMessage(error) });
        }),
      );
    });
  }

  /**
   * Serial ポートから切断（Observable）
   */
  disconnect$(): Observable<void> {
    return defer(() => {
      if (!this.session) {
        return of(undefined);
      }
      const session = this.session;
      return session.disconnect$().pipe(
        defaultIfEmpty(undefined),
        tap(() => {
          if (this.session === session) {
            this.tearDownSession();
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
    return this.session?.getCurrentPort() ?? undefined;
  }

  /**
   * データを書き込む。{@link SerialSession.send$} へ委譲（未接続時はライブラリが fail fast）。
   * セッションが無い場合のみ throwError（`Serial port not connected`）。
   */
  send$(data: string): Observable<void> {
    return defer(() => {
      const s = this.session;
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

  private tearDownSession(): void {
    this.session = undefined;
    this.activeSession$.next(undefined);
  }
}
