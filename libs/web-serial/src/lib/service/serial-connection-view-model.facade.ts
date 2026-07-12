/// <reference types="@types/w3c-web-serial" />

import {
  computed,
  effect,
  Injectable,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';
import { TerminalCommandRequestService } from './terminal-command-request.service';
import { firstValueFrom } from 'rxjs';
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
  private readonly connectRequestSignal = signal<{ baudRate: number } | null>(
    null,
  );
  private readonly connectRequestIdSignal = signal(0);
  private readonly disconnectRequestIdSignal = signal(0);
  private connectRequestCounter = 0;
  private disconnectRequestCounter = 0;
  private lastConnectRequestId = 0;
  private lastDisconnectRequestId = 0;

  constructor() {
    effect(() => {
      const request = this.connectRequestSignal();
      const requestId = this.connectRequestIdSignal();
      if (!request || requestId === this.lastConnectRequestId) {
        return;
      }
      this.lastConnectRequestId = requestId;
      const { baudRate } = request;
      untracked(() => {
        void this.runConnect(baudRate);
      });
    });

    effect(() => {
      const requestId = this.disconnectRequestIdSignal();
      if (requestId === 0 || requestId === this.lastDisconnectRequestId) {
        return;
      }
      this.lastDisconnectRequestId = requestId;
      untracked(() => {
        void this.runDisconnect();
      });
    });
  }

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
    this.connectRequestCounter += 1;
    this.connectRequestIdSignal.set(this.connectRequestCounter);
    this.connectRequestSignal.set({ baudRate });
  }

  disconnect(): void {
    this.disconnectRequestCounter += 1;
    this.disconnectRequestIdSignal.set(this.disconnectRequestCounter);
  }

  private async runConnect(baudRate: number): Promise<void> {
    try {
      const result = await firstValueFrom(this.serial.connect$(baudRate));
      if (result.ok) {
        this.errorMessageSignal.set(null);
        this.notifications.notifyConnectionSuccess();
      } else {
        this.errorMessageSignal.set(result.errorMessage);
        this.notifications.notifyConnectionError(result.errorMessage);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.errorMessageSignal.set(message);
    }
  }

  private async runDisconnect(): Promise<void> {
    try {
      await firstValueFrom(this.serial.disconnect$());
      this.errorMessageSignal.set(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.errorMessageSignal.set(message);
    }
  }

  /** ツールバーと同じキュー経路でコンソール向けコマンドを送信する（#615: send$ 経路）。 */
  sendCommand(command: string): void {
    this.terminalCommandRequests.requestCommand(command);
  }

  clearError(): void {
    this.errorMessageSignal.set(null);
  }
}
