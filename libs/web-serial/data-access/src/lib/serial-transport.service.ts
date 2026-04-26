/// <reference types="@types/w3c-web-serial" />

import { Injectable } from '@angular/core';
import { createSerialSession, type SerialSession } from '@gurezo/web-serial-rxjs';
import {
  catchError,
  defaultIfEmpty,
  defer,
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
 * v2 @gurezo/web-serial-rxjs の SerialSession を直接利用
 *
 * v2.1.0 では {@link SerialSession.receiveReplay$} と {@link SerialSession.getCurrentPort}
 * により、自前の ReplaySubject 中継や getPorts 突合が不要。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialTransportService {
  private session: SerialSession | undefined;
  private stateSub: Subscription | undefined;
  /** {@link SerialSession#isConnected$} から同期（同期版 {@link isConnected} 用） */
  private connected = false;

  private wireStateSubscription(s: SerialSession): void {
    this.stateSub?.unsubscribe();
    this.stateSub = s.isConnected$.subscribe((on) => {
      this.connected = on;
    });
  }

  private tearDownSession(): void {
    this.stateSub?.unsubscribe();
    this.stateSub = undefined;
    this.session = undefined;
    this.connected = false;
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
      this.wireStateSubscription(session);
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
          // connect$ 成功直後: isConnected$ が次ティックで true になる前に
          // Facade から getReadStream → startReadLoop が走るのを防ぐ
          this.connected = true;
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
   * 接続状態を取得
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 現在の SerialPort を取得
   */
  getPort(): SerialPort | undefined {
    return this.session?.getCurrentPort() ?? undefined;
  }

  /**
   * 読み取りストリーム（文字列）を取得
   * 未接続時またはエラー時は throwError
   *
   * チャンクの replay は {@link SerialSession.receiveReplay$}（createSerialSession 時に有効化）。
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
    if (!this.session || !this.connected) {
      return throwError(() => new Error('Serial port not connected'));
    }
    return this.session.send$(data).pipe(
      catchError((error) =>
        throwError(() => new Error(getWriteErrorMessage(error)))
      )
    );
  }
}
