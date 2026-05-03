/// <reference types="@types/w3c-web-serial" />

/** Full rewrite (#606). Connect lifecycle around {@link SerialTransportService}. */
import { Injectable, inject } from '@angular/core';
import {
  catchError,
  defer,
  of,
  type Observable,
  Subject,
  switchMap,
  take,
  throwError,
} from 'rxjs';
import { getConnectionErrorMessage } from '@libs-web-serial-util';
import { PiZeroShellReadinessService } from './pi-zero-shell-readiness.service';
import { SerialCommandPipelineService } from './serial-command/serial-command-facade.service';
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

  /**
   * 成功したシリアル接続ごとに単調増加するセッション識別子。
   * 接続ライフサイクルのみ本サービスがインクリメントし、bootstrap 済み判定は `PiZeroSessionService` 側の責務。
   */
  private connectionEpoch = 0;

  private readonly connectionEstablished = new Subject<void>();
  readonly connectionEstablished$ = this.connectionEstablished.asObservable();

  connect$(baudRate = 115200): Observable<SerialConnectResult> {
    return defer(() =>
      this.transport.isConnected$.pipe(
        take(1),
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
          this.connectionEpoch += 1;
          this.shellReadiness.reset();
          this.connectionEstablished.next();
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
   * Feature / Facade には露出しない（[#647](https://github.com/gurezo/chirimen-lite-console/issues/647)）。
   */
  getConnectionEpoch(): number {
    return this.connectionEpoch;
  }
}
