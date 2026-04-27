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
 * 受信はチャンク単位: `createSerialSession({ receiveReplay: { enabled: true } })` により
 * {@link SerialSession.receiveReplay$} を使い、同一接続内で遅延購読者（例: ターミナル）へ
 * 直近バッファを引き渡す。行単位が欲しい場合はライブラリの `lines$` を別経路で購読する（シェル exec はチャンク蓄積が必要なため従来どおり `receiveReplay$` + Command バッファ）。
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
        receiveReplay: { enabled: true, bufferSize: 512 },
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

  /**
   * 同期の接続判定。ライブラリの {@link SerialSession.getCurrentPort} に委譲。
   */
  isConnected(): boolean {
    return this.session?.getCurrentPort() != null;
  }

  getPort(): SerialPort | undefined {
    return this.session?.getCurrentPort() ?? undefined;
  }

  /**
   * 読み取りストリーム（文字列）を取得
   * 未接続時またはエラー時は throwError
   */
  getReadStream(): Observable<string> {
    if (!this.session) {
      return throwError(() => new Error('Serial port not connected'));
    }
    return this.session.receiveReplay$.pipe(
      catchError((err: unknown) =>
        throwError(() => new Error(getReadErrorMessage(err)))
      )
    );
  }

  /**
   * データを書き込む
   * 未接続時またはエラー時は throwError
   */
  write(data: string): Observable<void> {
    if (!this.session || !this.isConnected()) {
      return throwError(() => new Error('Serial port not connected'));
    }
    return this.session.send$(data).pipe(
      catchError((error) =>
        throwError(() => new Error(getWriteErrorMessage(error)))
      )
    );
  }

  private tearDownSession(): void {
    this.session = undefined;
    this.activeSession$.next(undefined);
  }
}
