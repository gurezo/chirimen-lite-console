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

  /** ライブラリ {@link SerialSession.state$}。未接続時は `idle` を継続発火。 */
  readonly state$ = this.activeSession$.pipe(
    switchMap((s) =>
      s
        ? s.state$
        : concat(of(SerialSessionState.Idle), NEVER)
    ),
    distinctUntilChanged()
  );

  /** ライブラリ {@link SerialSession.isConnected$}。未接続時は `false` を継続。 */
  readonly isConnected$ = this.activeSession$.pipe(
    switchMap((s) =>
      s ? s.isConnected$ : concat(of(false), NEVER)
    ),
    distinctUntilChanged()
  );

  /**
   * ライブラリ {@link SerialSession.lines$}。未接続時は無限に完了しない空ストリーム。
   */
  readonly lines$ = this.activeSession$.pipe(
    switchMap((s) => (s ? s.lines$ : NEVER))
  );

  /** 生チャンク（内部用途）。 */
  readonly receive$ = this.activeSession$.pipe(
    switchMap((s) => s?.receive$ ?? EMPTY)
  );

  /** terminal helper で整形済みの表示向けテキスト。 */
  readonly terminalText$ = this.activeSession$.pipe(
    switchMap((s) => (s ? s.terminalText$ : NEVER))
  );

  /**
   * ライブラリ {@link SerialSession.receiveReplay$}。未接続時は空ストリーム。
   * 後方互換用途のみ（terminal 表示は {@link #terminalText$} を優先）。
   */
  get receiveReplay$(): Observable<string> {
    return this.activeSession$.pipe(
      switchMap((s) => s?.receiveReplay$ ?? EMPTY)
    );
  }

  /**
   * I/O エラー（`SerialError`）のライブラリ本流。未接続時は空ストリーム。
   */
  get errors$(): Observable<SerialError> {
    return this.activeSession$.pipe(
      switchMap((s) => s?.errors$ ?? EMPTY)
    );
  }

  get portInfo$(): Observable<SerialPortInfo | null> {
    return this.activeSession$.pipe(
      switchMap((s) => s?.portInfo$ ?? of(null))
    );
  }

  getPortInfo(): SerialPortInfo | null {
    return this.session?.getPortInfo() ?? null;
  }

  /**
   * Serial ポートに接続（Observable）
   * @param baudRate ボーレート (デフォルト: 115200)
   */
  connect$(
    baudRate = 115200
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
                new Error('Port is not available after connection')
              ),
            });
          }
          return of({ port });
        }),
        catchError((error) => {
          this.tearDownSession();
          return of({ error: getConnectionErrorMessage(error) });
        })
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
        })
      );
    });
  }

  getPort(): SerialPort | undefined {
    return this.session?.getCurrentPort() ?? undefined;
  }

  /**
   * 読み取りストリーム（**1 改行区切りごとに 1 エミット**する行文字列）。
   * 接続済みチェックのためセッション欠如時は throwError（{@link #lines$} は未接続時 `NEVER`）。
   */
  getReadStream(): Observable<string> {
    return defer(() => {
      if (!this.session) {
        return throwError(() => new Error('Serial port not connected'));
      }
      return this.lines$;
    });
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
          throwError(() => new Error(getWriteErrorMessage(error)))
        )
      );
    });
  }

  /** @deprecated `send$` を使用すること。 */
  write(data: string): Observable<void> {
    return this.send$(data);
  }

  private tearDownSession(): void {
    this.session = undefined;
    this.activeSession$.next(undefined);
  }
}
