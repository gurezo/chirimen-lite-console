/// <reference types="@types/w3c-web-serial" />

import { Injectable } from '@angular/core';
import { createSerialSession, type SerialSession } from '@gurezo/web-serial-rxjs';
import {
  catchError,
  defaultIfEmpty,
  defer,
  from,
  map,
  Observable,
  of,
  ReplaySubject,
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
  /** {@link SerialSession#isConnected$} から同期（同期版 {@link isConnected} 用） */
  private connected = false;
  /** 接続成功後、getPorts + USB 突合で解決（{@link getPort} 用） */
  private cachedPort: SerialPort | undefined;

  /**
   * v2 では接続直後に受信が始まるが、購読前のチャンクは捨てられる。
   * {@link #beginReceiveReplayBuffer} を connect$ 内で getPorts より先に行い、
   * ここに一度だけ中継してから UI / Command 側が遅延購読しても起動ログを再現する。
   */
  private readReplay$?: ReplaySubject<string>;
  private receiveToReplaySub: Subscription | undefined;
  private readShared$: Observable<string> | null = null;

  private wireStateSubscription(s: SerialSession): void {
    this.stateSub?.unsubscribe();
    this.stateSub = s.isConnected$.subscribe((on) => {
      this.connected = on;
    });
  }

  private tearDownSession(): void {
    this.stateSub?.unsubscribe();
    this.stateSub = undefined;
    this.receiveToReplaySub?.unsubscribe();
    this.receiveToReplaySub = undefined;
    this.readReplay$?.complete();
    this.readReplay$ = undefined;
    this.session = undefined;
    this.connected = false;
    this.cachedPort = undefined;
    this.readShared$ = null;
  }

  /**
   * connect$ 直後（getPorts 等の前）に 1 回呼ぶ。`receive$` へ即購読し Replay に流す。
   * ドキュメントの行区切りは `lines$` だが、ここはプロンプト照合用にチャンク列が必要なため
   * `receive$` を用いる（SerialSession 概要: receive$ vs lines$）。
   */
  private beginReceiveReplayBuffer(): void {
    this.receiveToReplaySub?.unsubscribe();
    this.readReplay$?.complete();
    if (!this.session) {
      return;
    }
    this.readReplay$ = new ReplaySubject<string>(512);
    this.receiveToReplaySub = this.session.receive$.subscribe({
      next: (chunk) => {
        this.readReplay$?.next(chunk);
      },
      error: (err: unknown) => {
        this.readReplay$?.error(new Error(getReadErrorMessage(err)));
      },
    });
    this.readShared$ = this.readReplay$.asObservable();
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
        switchMap(() => {
          this.beginReceiveReplayBuffer();
          return from(this.resolveGrantedPortAsync()).pipe(
            map((port): { port: SerialPort } | { error: string } => {
              if (!port) {
                this.tearDownSession();
                return {
                  error: getConnectionErrorMessage(
                    new Error('Port is not available after connection')
                  ),
                };
              }
              this.cachedPort = port;
              // connect$ 成功直後: isConnected$ が次ティックで true になる前に
              // Facade から getReadStream → startReadLoop が走るのを防ぐ
              this.connected = true;
              return { port };
            })
          );
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
    return this.cachedPort;
  }

  /**
   * 読み取りストリーム（文字列）を取得
   * 未接続時またはエラー時は throwError
   *
   * v2: `isConnected$` より前に本メソッドが呼ばれ得るため、`readShared$` がある
   * （connect$ 内で beginReceive 済み）なら接続扱いとする。
   */
  getReadStream(): Observable<string> {
    if (!this.session) {
      return throwError(() => new Error('Serial port not connected'));
    }
    if (!this.readShared$) {
      this.beginReceiveReplayBuffer();
    }
    if (!this.readShared$) {
      return throwError(() => new Error('Serial read stream not available'));
    }
    return this.readShared$;
  }

  /**
   * データを書き込む
   * 未接続時またはエラー時は throwError
   */
  write(data: string): Observable<void> {
    if (!this.session) {
      return throwError(() => new Error('Serial port not connected'));
    }
    if (!this.readShared$) {
      return throwError(() => new Error('Serial port not connected'));
    }
    return this.session.send$(data).pipe(
      catchError((error) =>
        throwError(() => new Error(getWriteErrorMessage(error)))
      )
    );
  }
}
