/** Full rewrite (#606). Pi Zero session orchestration via {@link SerialFacadeService}. */
import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  catchError,
  defer,
  distinctUntilChanged,
  EMPTY,
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
import type { SerialSetupStatus } from '../models';
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
  /**
   * 最後に接続後 bootstrap が完了した接続 epoch。`SerialConnectionOrchestrationService` の値と突き合わせる。
   */
  private bootstrappedEpoch = -1;

  /** 現在進行中の `runAfterConnect$` パイプライン（同一接続 epoch での重複起動を防ぐ）。 */
  private activeBootstrap$: Observable<void> | null = null;

  /** `activeBootstrap$` が属する接続 epoch。finalize で当該 epoch のみクリーンアップする。 */
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

    this.serial.connectionEstablished$
      .pipe(
        switchMap(() => this.runAfterConnect$()),
        catchError((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(
            '[PiZeroSession] post-connect bootstrap failed:',
            message,
          );
          return EMPTY;
        }),
      )
      .subscribe();
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
   * `connectionEstablished$` 直後は `isConnected$` の反映が遅れることがあるため、
   * 接続 epoch のみで判定する（issue #717）。
   */
  shouldRunAfterConnect$(): Observable<boolean> {
    return of(this.shouldRunAfterConnect());
  }

  private shouldRunAfterConnect(): boolean {
    const epoch = this.connection.getConnectionEpoch();
    if (epoch <= 0) {
      return false;
    }
    return epoch !== this.bootstrappedEpoch;
  }

  private markShellReadyIfActive(epoch: number): void {
    const currentEpoch = this.connection.getConnectionEpoch();
    if (
      this.activeBootstrapEpoch === epoch &&
      currentEpoch === epoch
    ) {
      this.shellReadiness.setReady(true);
    }
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
          tap(() => {
            this.markShellReadyIfActive(epoch);
            this.setupStatusSubject.next('waiting-shell');
          }),
          tap(() => this.setupStatusSubject.next('setting-timezone')),
          switchMap(() => this.bootstrap.setupEnvironment$(onBootstrapStatus)),
          switchMap(() =>
            this.serial.isConnected$.pipe(
              take(1),
              tap((connected) => {
                const currentEpoch = this.connection.getConnectionEpoch();
                if (
                  connected &&
                  currentEpoch === epoch &&
                  this.activeBootstrapEpoch === epoch
                ) {
                  this.bootstrappedEpoch = epoch;
                  this.setupStatusSubject.next('ready');
                } else if (connected && currentEpoch !== epoch) {
                  // 再接続などで接続 epoch が進んだあとに遅延完了したパイプラインは成功扱いにしない
                  this.setupStatusSubject.next('idle');
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
