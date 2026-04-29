/// <reference types="@types/w3c-web-serial" />

import { Injectable, inject } from '@angular/core';
import { SerialSessionState } from '@gurezo/web-serial-rxjs';
import { TerminalCommandRequestService } from '@libs-terminal-util';
import {
  BehaviorSubject,
  combineLatest,
  map,
  type Observable,
  shareReplay,
  take,
  tap,
} from 'rxjs';
import { PiZeroSessionService } from './pi-zero-session.service';
import { PiZeroShellReadinessService } from './pi-zero-shell-readiness.service';
import { SerialFacadeService } from './serial-facade.service';
import { SerialNotificationService } from './serial-notification.service';

/**
 * UI から参照する単一オブジェクトへのシリアル接続状態 (#564)。
 *
 * **`isLoggedIn`**: OAuth ログインなどではなく、Pi Zero に対するシリアル経由ログイン済みおよび
 * ブートストラップ完了（シェルプロンプト到達、`PiZeroShellReadiness.ready$` と同義）を指す。
 */
export interface SerialConnectionViewModel {
  isBrowserSupported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  isLoggedIn: boolean;
  isInitializing: boolean;
  errorMessage: string | null;
}

/**
 * Terminal のツールバー等からの送信と同一パスの {@link TerminalCommandRequestService.requestCommand}
 * でシェル実行をキューする（#564）。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialConnectionViewModelFacade {
  private readonly serial = inject(SerialFacadeService);
  private readonly piZero = inject(PiZeroSessionService);
  private readonly shellReadiness = inject(PiZeroShellReadinessService);
  private readonly notifications = inject(SerialNotificationService);
  private readonly terminalCommandRequests = inject(
    TerminalCommandRequestService,
  );

  private readonly errorSubject = new BehaviorSubject<string | null>(null);

  private readonly browserSupported =
    typeof navigator !== 'undefined' && 'serial' in navigator;

  readonly vm$: Observable<SerialConnectionViewModel> = combineLatest([
    this.serial.state$,
    this.serial.isConnected$,
    this.piZero.initializing$,
    this.shellReadiness.ready$,
    this.errorSubject.asObservable(),
  ]).pipe(
    map(([state, connected, initializing, loggedInReady, errorMessage]) => ({
      isBrowserSupported: this.browserSupported,
      isConnected: connected,
      isConnecting: state === SerialSessionState.Connecting,
      isLoggedIn: loggedInReady,
      isInitializing: initializing,
      errorMessage,
    })),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** @param baudRate 既定 115200 */
  connect(baudRate = 115200): void {
    this.serial
      .connect$(baudRate)
      .pipe(
        take(1),
        tap((result) => {
          if (result.ok) {
            this.errorSubject.next(null);
            this.notifications.notifyConnectionSuccess();
          } else {
            this.errorSubject.next(result.errorMessage);
            this.notifications.notifyConnectionError(result.errorMessage);
          }
        }),
      )
      .subscribe();
  }

  disconnect(): void {
    this.serial
      .disconnect$()
      .pipe(
        take(1),
        tap(() => this.errorSubject.next(null)),
      )
      .subscribe({
        error: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : String(err);
          this.errorSubject.next(message);
        },
      });
  }

  /** ツールバーと同じキュー経路でコンソール向けコマンドを送信する。 */
  sendCommand(command: string): void {
    this.terminalCommandRequests.requestCommand(command);
  }

  clearError(): void {
    this.errorSubject.next(null);
  }
}
