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
  defaultIfEmpty,
  defer,
  distinctUntilChanged,
  EMPTY,
  Observable,
  of,
  Subscription,
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
 * 受信はチャンク単位: `createSerialSession({ receiveReplay: { enabled: true } })` により
 * {@link SerialSession.receiveReplay$} を使い、同一接続内で遅延購読者（例: ターミナル）へ
 * 直近バッファを引き渡す。行単位が欲しい場合はライブラリの `lines$` を別経路で購読する（シェル exec はチャンク蓄積が必要なため従来どおり `receiveReplay$` + Command バッファ）。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialTransportService {
  private session: SerialSession | undefined;
  private sessionSubscription = new Subscription();

  /** 接続中セッションの `state$` をミラー。未接続・切断後は `idle`。 */
  private readonly lifecycleState$ = new BehaviorSubject<SerialSessionState>(
    SerialSessionState.Idle
  );
  private readonly isConnectedState$ = new BehaviorSubject(false);

  /** @gurezo/web-serial-rxjs 2.1.0 が npm 上の最新。API は TypeDoc 参照。 */
  readonly state$ = this.lifecycleState$
    .asObservable()
    .pipe(distinctUntilChanged());

  /** ライブラリの `isConnected$` をミラー（未接続時は `false`）。 */
  readonly isConnected$ = this.isConnectedState$
    .asObservable()
    .pipe(distinctUntilChanged());

  private wireSession(s: SerialSession): void {
    this.sessionSubscription.unsubscribe();
    this.sessionSubscription = new Subscription();
    this.sessionSubscription.add(
      s.state$.subscribe((st) => this.lifecycleState$.next(st))
    );
    this.sessionSubscription.add(
      s.isConnected$.subscribe((on) => this.isConnectedState$.next(on))
    );
  }

  private tearDownSession(): void {
    this.sessionSubscription.unsubscribe();
    this.sessionSubscription = new Subscription();
    this.session = undefined;
    this.lifecycleState$.next(SerialSessionState.Idle);
    this.isConnectedState$.next(false);
  }

  /**
   * I/O エラー（`SerialError`）のライブラリ本流。未接続時は空ストリーム。
   */
  get errors$(): Observable<SerialError> {
    return this.session?.errors$ ?? EMPTY;
  }

  get portInfo$(): Observable<SerialPortInfo | null> {
    return this.session?.portInfo$ ?? of(null);
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
      this.wireSession(session);
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

  isConnected(): boolean {
    return this.isConnectedState$.getValue();
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
}
