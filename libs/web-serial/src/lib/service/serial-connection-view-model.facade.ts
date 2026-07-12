/// <reference types="@types/w3c-web-serial" />

import { computed, Injectable, inject, signal } from '@angular/core';
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';
import { TerminalCommandRequestService } from './terminal-command-request.service';
import { take, tap } from 'rxjs';
import { PiZeroSessionService } from './pi-zero-session.service';
import { PiZeroShellReadinessService } from './pi-zero-shell-readiness.service';
import type { SerialSetupStatus } from '../models';
import { SerialFacadeService } from './serial-facade.service';
import { SerialNotificationService } from './serial-notification.service';

/**
 * UI から参照する単一オブジェクトへのシリアル接続状態 (#564)。
 *
 * **`isLoggedIn`**: OAuth ログインなどではなく、Pi Zero に対するシリアル経由ログイン済みおよび
 * ブートストラップ完了（シェルプロンプト到達、`PiZeroShellReadiness.ready` と同義）を指す。
 */
export interface SerialConnectionViewModel {
  isBrowserSupported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  isLoggedIn: boolean;
  isInitializing: boolean;
  setupStatus: SerialSetupStatus;
  errorMessage: string | null;
}

/**
 * Terminal のツールバー等からの送信と同一パスの {@link TerminalCommandRequestService.requestCommand}
 * でシェル実行をキューする（#564）。実送信はターミナル側で {@link SerialFacadeService#send$} となり、
 * {@link SerialFacadeService#exec$} は使わない（親 #609 / #615）。
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

  private readonly errorMessageSignal = signal<string | null>(null);

  readonly vm = computed<SerialConnectionViewModel>(() => {
    const state = this.serial.state();
    const setupStatus = this.piZero.setupStatus();
    return {
      isBrowserSupported: this.serial.isBrowserSupported(),
      isConnected: this.serial.isConnected(),
      isConnecting: state.status === SerialSessionStatus.Connecting,
      isLoggedIn: this.shellReadiness.ready(),
      isInitializing: this.piZero.initializing(),
      setupStatus,
      errorMessage: this.errorMessageSignal(),
    };
  });

  /** @param baudRate 既定 115200 */
  connect(baudRate = 115200): void {
    this.serial
      .connect$(baudRate)
      .pipe(
        take(1),
        tap((result) => {
          if (result.ok) {
            this.errorMessageSignal.set(null);
            this.notifications.notifyConnectionSuccess();
          } else {
            this.errorMessageSignal.set(result.errorMessage);
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
        tap(() => this.errorMessageSignal.set(null)),
      )
      .subscribe({
        error: (err: unknown) => {
          const message =
            err instanceof Error ? err.message : String(err);
          this.errorMessageSignal.set(message);
        },
      });
  }

  /** ツールバーと同じキュー経路でコンソール向けコマンドを送信する（#615: send$ 経路）。 */
  sendCommand(command: string): void {
    this.terminalCommandRequests.requestCommand(command);
  }

  clearError(): void {
    this.errorMessageSignal.set(null);
  }
}
