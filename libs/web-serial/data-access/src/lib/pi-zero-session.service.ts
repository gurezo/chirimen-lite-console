/** Full rewrite (#606). Pi Zero session orchestration via {@link SerialFacadeService}. */
import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  catchError,
  defer,
  distinctUntilChanged,
  finalize,
  map,
  type Observable,
  of,
  shareReplay,
  switchMap,
  take,
  tap,
  throwError,
} from 'rxjs';
import type { PiZeroBootstrapStatusHandler } from './pi-zero-serial-bootstrap.service';
import { PiZeroSerialBootstrapService } from './pi-zero-serial-bootstrap.service';
import { PiZeroShellReadinessService } from './pi-zero-shell-readiness.service';
import type { SerialSetupStatus } from './serial-setup-status';
import { SerialConnectionOrchestrationService } from './serial-connection-orchestration.service';
import type { SerialFacadeConnectResult } from './serial-facade.service';
import { SerialFacadeService } from './serial-facade.service';

/**
 * Pi Zero / CHIRIMEN 固有シリアルセッションの単一エントリ（issue #562）。
 *
 * 汎用の送受信は {@link SerialFacadeService}。本サービスは接続・切断・接続後パイプラインを束ねる。
 */
@Injectable({
  providedIn: 'root',
})
export class PiZeroSessionService {
  private lastBootstrappedEpoch = -1;
  private activeBootstrap$: Observable<void> | null = null;
  private activeBootstrapEpoch: number | null = null;

  private readonly initializingSubject = new BehaviorSubject(false);
  private readonly setupStatusSubject =
    new BehaviorSubject<SerialSetupStatus>('idle');

  /**
   * 接続後の Pi Zero 初期化パイプライン（ログイン・環境セットアップ等）実行中。
   */
  readonly initializing$ = this.initializingSubject.pipe(distinctUntilChanged());
  readonly setupStatus$ = this.setupStatusSubject.pipe(distinctUntilChanged());

  constructor(
    private readonly serial: SerialFacadeService,
    private readonly bootstrap: PiZeroSerialBootstrapService,
    readonly shellReadiness: PiZeroShellReadinessService,
    private readonly connection: SerialConnectionOrchestrationService,
  ) {
    this.setupStatus$.subscribe((status) => {
      const isInitializing =
        status !== 'idle' && status !== 'ready' && status !== 'failed';
      this.initializingSubject.next(isInitializing);
    });
  }

  connect$(baudRate = 115200): Observable<SerialFacadeConnectResult> {
    return this.serial.connect$(baudRate);
  }

  disconnect$(): Observable<void> {
    return this.serial.disconnect$();
  }

  loginIfNeeded$(
    onStatus?: PiZeroBootstrapStatusHandler,
  ): Observable<void> {
    return this.bootstrap.loginIfNeeded$(onStatus);
  }

  setupEnvironment$(
    onStatus?: PiZeroBootstrapStatusHandler,
  ): Observable<void> {
    return this.bootstrap.setupEnvironment$(onStatus);
  }

  /**
   * 接続セッションごとに 1 回、初期化パイプラインを走らせるか。
   */
  shouldRunAfterConnect$(): Observable<boolean> {
    return this.serial.isConnected$.pipe(
      take(1),
      map((connected) => {
        if (!connected) {
          return false;
        }
        const epoch = this.connection.getConnectionEpoch();
        if (epoch === this.lastBootstrappedEpoch) {
          return false;
        }
        return true;
      }),
    );
  }

  /**
   * 接続セッション内で未初期化の場合のみ login + 環境セットアップを実行する。
   */
  runAfterConnect$(
    onStatus?: PiZeroBootstrapStatusHandler,
  ): Observable<void> {
    const log = onStatus ?? (() => undefined);
    const onBootstrapStatus = (line: string): void => {
      if (line.includes('ログインユーザー')) {
        this.setupStatusSubject.next('sending-username');
      } else if (line.includes('パスワードを送信中')) {
        this.setupStatusSubject.next('sending-password');
      }
      log(line);
    };

    return this.shouldRunAfterConnect$().pipe(
      switchMap((shouldRun) => {
        if (!shouldRun) {
          return of(undefined);
        }
        const epoch = this.connection.getConnectionEpoch();

        if (
          this.activeBootstrap$ !== null &&
          this.activeBootstrapEpoch === epoch
        ) {
          return this.activeBootstrap$;
        }

        this.activeBootstrapEpoch = epoch;

        this.activeBootstrap$ = defer(() => {
          this.setupStatusSubject.next('waiting-login');
          return of(undefined);
        }).pipe(
          switchMap(() => this.bootstrap.loginIfNeeded$(onBootstrapStatus)),
          tap(() => this.setupStatusSubject.next('waiting-shell')),
          tap(() => this.setupStatusSubject.next('setting-timezone')),
          switchMap(() => this.bootstrap.setupEnvironment$(onBootstrapStatus)),
          switchMap(() =>
            this.serial.isConnected$.pipe(
              take(1),
              tap((connected) => {
                if (connected) {
                  this.lastBootstrappedEpoch = epoch;
                  this.shellReadiness.setReady(true);
                  this.setupStatusSubject.next('ready');
                }
              }),
              map(() => undefined),
            ),
          ),
          catchError((error: unknown) => {
            const message =
              error instanceof Error ? error.message : String(error);
            this.setupStatusSubject.next('failed');
            log(`[コンソール] 接続後の初期化に失敗しました: ${message}`);
            return throwError(() => error);
          }),
          finalize(() => {
            if (this.activeBootstrapEpoch === epoch) {
              this.activeBootstrap$ = null;
              this.activeBootstrapEpoch = null;
            }
          }),
          shareReplay({ bufferSize: 1, refCount: true }),
        );

        return this.activeBootstrap$;
      }),
    );
  }
}
