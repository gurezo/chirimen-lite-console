/// <reference types="@types/w3c-web-serial" />

import { computed, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  createSerialSession,
  SerialSessionStatus,
  type SerialSession,
  type SerialSessionState,
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
import { RASPBERRY_PI_ZERO_INFO } from '../constants';
import { getConnectionErrorMessage, getWriteErrorMessage } from '../functions';

/**
 * Angular 向けの薄いアダプタ。実体は常に `@gurezo/web-serial-rxjs` の {@link SerialSession} 1 個。
 *
 * 読み取り状態は Signal（`state` / `isConnected` / `terminalText` 等）で公開する。
 * 生の `receive$` は data-access 内部専用の Observable のまま維持する。
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

  private readonly stateSource$ = this.fromSession(
    (s) => s.state$,
    concat(of({ status: SerialSessionStatus.Idle }), NEVER),
  ).pipe(distinctUntilChanged());

  private readonly linesSource$ = this.fromSession(
    (s) => s.lines$,
    concat(of(''), NEVER),
  );

  /**
   * {@link SerialSession.receive$}（UTF-8 デコード済みの生チャンク）。
   * getty が行末を lone `\r` のみにすると {@link #lines} では行が emit されないことがあるため、
   * プロンプト待ちは {@link import('./serial-command/serial-command-pipeline.service').SerialCommandPipelineService} がこちらを購読する。
   */
  readonly receive$ = this.fromSession((s) => s.receive$, NEVER);

  private readonly terminalTextSource$ = this.fromSession(
    (s) => s.terminalText$,
    concat(of(''), NEVER),
  );

  private readonly errorsSource$ = this.fromSession(
    (s) => s.errors$ ?? EMPTY,
    EMPTY,
  );

  private readonly portInfoSource$ = this.fromSession(
    (s) => s.portInfo$ ?? of(null),
    of(null),
  );

  readonly state = toSignal(this.stateSource$, {
    initialValue: {
      status: SerialSessionStatus.Idle,
    } satisfies SerialSessionState,
  });

  readonly isConnected = computed(
    () => this.state().status === SerialSessionStatus.Connected,
  );

  readonly lines = toSignal(this.linesSource$, { initialValue: '' });

  /**
   * {@link SerialSession.terminalText$}。ターミナル UI のライブ表示用（TTY 再描画の畳み込みはライブラリ側）。
   */
  readonly terminalText = toSignal(this.terminalTextSource$, {
    initialValue: '',
  });

  readonly errors = toSignal(this.errorsSource$);

  readonly portInfo = toSignal(this.portInfoSource$, {
    initialValue: null as SerialPortInfo | null,
  });

  getPortInfo(): SerialPortInfo | null {
    return this.active?.getPortInfo() ?? null;
  }

  /**
   * {@link SerialSession.connect$} を呼び出し、Pi Zero フィルタでポートを開く。
   * 戻り値だけアプリ向けに `{ ok: true } | { error }` に整形する。
   */
  connect$(
    baudRate = 115200,
  ): Observable<{ ok: true } | { error: string }> {
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
          if (!session.getPortInfo()) {
            this.detachSession();
            return of({
              error: getConnectionErrorMessage(
                new Error('Port is not available after connection'),
              ),
            });
          }
          return of({ ok: true as const });
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

  /**
   * 現在接続中のポートが Raspberry Pi Zero 互換か判定する（Pi Zero 判定の集約先。[#674](https://github.com/gurezo/chirimen-lite-console/issues/674)）。
   */
  async isRaspberryPiZero(): Promise<boolean> {
    return this.isPiZeroPortInfo(this.getPortInfo());
  }

  private isPiZeroPortInfo(info: SerialPortInfo | null | undefined): boolean {
    if (info == null) {
      return false;
    }
    const { usbVendorId, usbProductId } = info;
    if (usbVendorId == null || usbProductId == null) {
      return false;
    }
    return (
      usbVendorId === RASPBERRY_PI_ZERO_INFO.usbVendorId &&
      usbProductId === RASPBERRY_PI_ZERO_INFO.usbProductId
    );
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
