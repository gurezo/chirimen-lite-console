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
  take,
  tap,
  throwError,
} from 'rxjs';
import {
  getConnectionErrorMessage,
  getReadErrorMessage,
  getWriteErrorMessage,
  RASPBERRY_PI_ZERO_INFO,
} from '@libs-web-serial-util';

/**
 * Serial 接続・読取・書込を一元化するサービス
 * v2 @gurezo/web-serial-rxjs の {@link SerialSession} を直接利用し、
 * `state$` / `isConnected$` / `errors$` 等をアプリ層に橋渡しする。
 *
 * 接続状態の Source of truth は常に `SerialSession` 側。
 * 本サービスは `activeSession$` のみで「どのセッションを流すか」を切り替え、
 * ライブラリの Observable を重ねて二重管理しない。
 *
 * 読み取りストリーム {@link #getReadStream} は {@link SerialSession.lines$} を橋渡しする
 * （行単位。区切りはライブラリ側の改行処理に従う）。チャンク生データは
 * {@link SerialSession.receive$} を直接使用する必要がある場合のみ利用する。
 */
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
   * 読み取りストリーム（**1 改行区切りごとに 1 エミット**する行文字列）を取得。
   * 未接続時または未接続状態で呼び出した場合は throwError
   */
  getReadStream(): Observable<string> {
    return defer(() => {
      const s = this.session;
      if (!s) {
        return throwError(() => new Error('Serial port not connected'));
      }
      return s.isConnected$.pipe(
        take(1),
        switchMap((connected) =>
          connected
            ? s.lines$.pipe(
                catchError((err: unknown) =>
                  throwError(() => new Error(getReadErrorMessage(err)))
                ),
              )
            : throwError(() => new Error('Serial port not connected'))
        )
      );
    });
  }

  /**
   * データを書き込む
   * 未接続時またはエラー時は throwError
   */
  write(data: string): Observable<void> {
    return defer(() => {
      const s = this.session;
      if (!s) {
        return throwError(() => new Error('Serial port not connected'));
      }
      return s.isConnected$.pipe(
        take(1),
        switchMap((connected) =>
          connected
            ? s.send$(data).pipe(
                catchError((error) =>
                  throwError(
                    () => new Error(getWriteErrorMessage(error)),
                  )
                )
              )
            : throwError(() => new Error('Serial port not connected'))
        )
      );
    });
  }

  private tearDownSession(): void {
    this.session = undefined;
    this.activeSession$.next(undefined);
  }
}
