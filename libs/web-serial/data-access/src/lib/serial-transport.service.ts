/// <reference types="@types/w3c-web-serial" />

import { Injectable } from '@angular/core';
import {
  createSerialSession,
  SerialSessionState,
  type SerialSession,
} from '@gurezo/web-serial-rxjs';
import {
  catchError,
  defaultIfEmpty,
  defer,
  from,
  map,
  Observable,
  of,
  share,
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
 * v2 では {@link SerialSession} に `currentPort` がないため、接続直後に
 * `navigator.serial.getPorts()` から RPi 用フィルタに一致するポートを解決する。
 * 将来ライブラリがポートを公開したらここを差し替え可能（Issue #536）。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialTransportService {
  private session: SerialSession | undefined;
  private stateSub: Subscription | undefined;
  /** {@link SerialSession#state$} から `connected` を同期 */
  private connected = false;
  /** 接続成功後、getPorts + USB 突合で解決（{@link getPort} 用） */
  private cachedPort: SerialPort | undefined;

  /**
   * port.readable は同時にロックできる Reader が 1 つだけのため、
   * getReadStream() を呼ぶたびに新しい Reader を取ると Facade の常時購読と
   * read$() などがデータを奪い合い、プロンプト待ちがタイムアウトする。
   * 1 本の Observable を share して多重購読する。
   */
  private readShared$: Observable<string> | null = null;

  private wireStateSubscription(s: SerialSession): void {
    this.stateSub?.unsubscribe();
    this.stateSub = s.state$.subscribe((state) => {
      this.connected = state === SerialSessionState.Connected;
    });
  }

  private tearDownSession(): void {
    this.stateSub?.unsubscribe();
    this.stateSub = undefined;
    this.session = undefined;
    this.connected = false;
    this.cachedPort = undefined;
    this.readShared$ = null;
  }

  /**
   * 接続成功直後: 付与済みポートのうち RPi Zero フィルタに一致するものを返す。
   * `getPorts()` は Promise を返す型定義に従い非同期で解決する。
   */
  private async resolveGrantedPortAsync(): Promise<SerialPort | undefined> {
    if (typeof navigator === 'undefined' || !navigator.serial) {
      return undefined;
    }
    const ports = await navigator.serial.getPorts();
    for (const port of ports) {
      const info = port.getInfo();
      if (
        info.usbVendorId === RASPBERRY_PI_ZERO_INFO.usbVendorId &&
        info.usbProductId === RASPBERRY_PI_ZERO_INFO.usbProductId
      ) {
        return port;
      }
    }
    return undefined;
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
      this.wireStateSubscription(session);
      return session.connect$().pipe(
        switchMap(() =>
          from(this.resolveGrantedPortAsync()).pipe(
            map((port): { port: SerialPort } | { error: string } => {
              if (!port) {
                return {
                  error: getConnectionErrorMessage(
                    new Error('Port is not available after connection')
                  ),
                };
              }
              this.cachedPort = port;
              return { port };
            })
          )
        ),
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
    return this.cachedPort;
  }

  /**
   * 読み取りストリーム（文字列）を取得
   * 未接続時またはエラー時は throwError
   */
  getReadStream(): Observable<string> {
    if (!this.session || !this.connected) {
      return throwError(() => new Error('Serial port not connected'));
    }
    if (!this.readShared$) {
      this.readShared$ = this.session.receive$.pipe(
        catchError((error) =>
          throwError(() => new Error(getReadErrorMessage(error)))
        ),
        share()
      );
    }
    return this.readShared$;
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
