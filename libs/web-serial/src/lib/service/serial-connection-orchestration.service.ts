/// <reference types="@types/w3c-web-serial" />

/** Full rewrite (#606). Connect lifecycle around {@link SerialTransportService}. */
import { Injectable, inject, Injector, signal } from '@angular/core';
import {
  catchError,
  defer,
  EMPTY,
  of,
  type Observable,
  switchMap,
  throwError,
} from 'rxjs';
import { getConnectionErrorMessage } from '../functions';
import { PiZeroSessionService } from './pi-zero-session.service';
import { PiZeroShellReadinessService } from './pi-zero-shell-readiness.service';
import { SerialCommandPipelineService } from './serial-command/serial-command-pipeline.service';
import { SerialNotificationService } from './serial-notification.service';
import { SerialTransportService } from './serial-transport.service';

/** {@link SerialConnectionOrchestrationService#connect$} の結果 */
export type SerialConnectResult =
  | { ok: true }
  | { ok: false; errorMessage: string };

/**
 * Transport / Command / ShellReadiness を接続ライフサイクル単位で束ねる。
 * {@link SerialFacadeService} は本サービスへの委譲のみとし、ここにオーケストレーションを集約する。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialConnectionOrchestrationService {
  private readonly transport = inject(SerialTransportService);
  private readonly command = inject(SerialCommandPipelineService);
  private readonly shellReadiness = inject(PiZeroShellReadinessService);
  private readonly notifications = inject(SerialNotificationService);
  private readonly injector = inject(Injector);

  /**
   * 成功したシリアル接続ごとに単調増加するセッション識別子。
   * 接続ライフサイクルのみ本サービスがインクリメントし、bootstrap 済み判定は `PiZeroSessionService` 側の責務。
   */
  private readonly connectionEpochSignal = signal(0);

  readonly connectionEpoch = this.connectionEpochSignal.asReadonly();

  connect$(baudRate = 115200): Observable<SerialConnectResult> {
    return defer(() =>
      of(this.transport.isConnected()).pipe(
        switchMap((connected) =>
          connected ? this.disconnect$() : of(undefined),
        ),
        switchMap(() => this.transport.connect$(baudRate)),
        switchMap((result) => {
          if ('error' in result) {
            console.error('Connection failed:', result.error);
            return of<SerialConnectResult>({
              ok: false,
              errorMessage: result.error,
            });
          }
          this.command.startReadLoop();
          this.connectionEpochSignal.update((epoch) => epoch + 1);
          this.shellReadiness.reset();
          this.shellReadiness.startWatching();
          this.schedulePostConnectBootstrap();
          return of<SerialConnectResult>({ ok: true });
        }),
        catchError((error: unknown) => {
          console.error('Connection error:', error);
          return of<SerialConnectResult>({
            ok: false,
            errorMessage: getConnectionErrorMessage(error),
          });
        }),
      ),
    );
  }

  disconnect$(): Observable<void> {
    this.injector.get(PiZeroSessionService).resetSession();
    this.shellReadiness.reset();
    this.command.cancelAllCommands();
    this.command.stopReadLoop();
    return this.transport.disconnect$().pipe(
      catchError((error) => {
        console.error('Disconnect error:', error);
        return throwError(() => error);
      }),
    );
  }

  /**
   * data-access 内部で接続セッションと bootstrap 状態を突き合わせるための API。
   */
  getConnectionEpoch(): number {
    return this.connectionEpochSignal();
  }

  /**
   * 接続確立直後に Pi Zero bootstrap を起動する（issue #717）。
   * `Injector` 経由で遅延解決し、オーケストレーションとの循環 DI を避ける。
   */
  private schedulePostConnectBootstrap(): void {
    queueMicrotask(() => {
      this.injector
        .get(PiZeroSessionService)
        .runAfterConnect$()
        .pipe(
          catchError((error: unknown) => {
            const message =
              error instanceof Error ? error.message : String(error);
            console.error(
              '[SerialConnection] post-connect bootstrap failed:',
              message,
            );
            this.notifications.notifyAutoLoginFailed(message);
            return EMPTY;
          }),
        )
        .subscribe();
    });
  }
}
