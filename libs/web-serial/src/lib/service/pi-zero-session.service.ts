/** Full rewrite (#606). Pi Zero session orchestration via {@link SerialFacadeService}. */
import { computed, Injectable, signal } from '@angular/core';
import {
  catchError,
  defer,
  EMPTY,
  finalize,
  map,
  type Observable,
  of,
  shareReplay,
  switchMap,
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
  private activeBootstrapGeneration: number | null = null;
  private sessionGeneration = 0;

  private readonly setupStatusSignal = signal<SerialSetupStatus>('idle');

  /**
   * 接続後の Pi Zero 初期化パイプライン（ログイン・環境セットアップ等）の進捗状態。
   */
  readonly setupStatus = this.setupStatusSignal.asReadonly();

  /**
   * 接続後の Pi Zero 初期化パイプライン（ログイン・環境セットアップ等）実行中。
   */
  readonly initializing = computed(() => {
    const status = this.setupStatusSignal();
    return status !== 'idle' && status !== 'ready' && status !== 'failed';
  });

  constructor(
    private readonly serial: SerialFacadeService,
    private readonly bootstrap: PiZeroSerialBootstrapService,
    readonly shellReadiness: PiZeroShellReadinessService,
    private readonly connection: SerialConnectionOrchestrationService,
  ) {}

  connect$(baudRate = 115200): Observable<SerialFacadeConnectResult> {
    return this.serial.connect$(baudRate);
  }

  disconnect$(): Observable<void> {
    return this.serial.disconnect$();
  }

  /**
   * 切断済みセッションの非同期処理を無効化し、次回接続を初期状態から開始する。
   */
  resetSession(): void {
    this.sessionGeneration += 1;
    this.bootstrappedEpoch = -1;
    this.activeBootstrap$ = null;
    this.activeBootstrapEpoch = null;
    this.activeBootstrapGeneration = null;
    this.setupStatusSignal.set('idle');
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
   * 接続確立直後は `isConnected` の反映が遅れることがあるため、
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

  private isSessionActive(epoch: number, generation: number): boolean {
    return (
      this.sessionGeneration === generation &&
      this.connection.getConnectionEpoch() === epoch
    );
  }

  private markShellReadyIfActive(epoch: number, generation: number): void {
    const currentEpoch = this.connection.getConnectionEpoch();
    if (
      this.activeBootstrapEpoch === epoch &&
      this.activeBootstrapGeneration === generation &&
      this.sessionGeneration === generation &&
      currentEpoch === epoch
    ) {
      this.shellReadiness.setReady(true);
    }
  }

  private runEnvironmentSetupInBackground(
    epoch: number,
    generation: number,
    onBootstrapStatus: PiZeroBootstrapStatusHandler,
    log: PiZeroBootstrapStatusHandler,
  ): void {
    // ファイルツリーの初回 ls を直列キューで先に通すため、環境設定はマクロタスクへ遅延する（issue #717）。
    setTimeout(() => {
      this.bootstrap
        .setupEnvironment$(onBootstrapStatus)
        .pipe(
          tap(() => {
            if (this.isSessionActive(epoch, generation)) {
              this.setupStatusSignal.set('ready');
            }
          }),
          catchError((error: unknown) => {
            const message =
              error instanceof Error ? error.message : String(error);
            if (this.isSessionActive(epoch, generation)) {
              this.setupStatusSignal.set('failed');
              log(`[コンソール] 環境設定に失敗しました: ${message}`);
            }
            return EMPTY;
          }),
          finalize(() => {
            if (
              this.activeBootstrapEpoch === epoch &&
              this.activeBootstrapGeneration === generation
            ) {
              this.activeBootstrap$ = null;
              this.activeBootstrapEpoch = null;
              this.activeBootstrapGeneration = null;
            }
          }),
        )
        .subscribe();
    });
  }

  /**
   * 接続セッション内で未初期化の場合のみ login + 環境セットアップを実行する。
   */
  runAfterConnect$(
    onStatus?: PiZeroBootstrapStatusHandler,
  ): Observable<void> {
    const log = onStatus ?? (() => undefined);

    return this.shouldRunAfterConnect$().pipe(
      switchMap((shouldRun) => {
        if (!shouldRun) {
          return of(undefined);
        }
        const epoch = this.connection.getConnectionEpoch();
        const generation = this.sessionGeneration;
        const onBootstrapStatus = (line: string): void => {
          if (!this.isSessionActive(epoch, generation)) {
            return;
          }
          if (line.includes('ログインユーザー')) {
            this.setupStatusSignal.set('sending-username');
          } else if (line.includes('パスワードを送信中')) {
            this.setupStatusSignal.set('sending-password');
          }
          log(line);
        };

        if (
          this.activeBootstrap$ !== null &&
          this.activeBootstrapEpoch === epoch &&
          this.activeBootstrapGeneration === generation
        ) {
          return this.activeBootstrap$;
        }

        this.activeBootstrapEpoch = epoch;
        this.activeBootstrapGeneration = generation;

        this.activeBootstrap$ = defer(() => {
          this.setupStatusSignal.set('waiting-login');
          return of(undefined);
        }).pipe(
          switchMap(() =>
            this.shellReadiness.isReady()
              ? of(undefined)
              : this.bootstrap.loginIfNeeded$(onBootstrapStatus),
          ),
          tap(() => {
            if (!this.shellReadiness.isReady()) {
              this.markShellReadyIfActive(epoch, generation);
            }
            if (!this.isSessionActive(epoch, generation)) {
              return;
            }
            this.bootstrappedEpoch = epoch;
            this.setupStatusSignal.set('setting-timezone');
            this.runEnvironmentSetupInBackground(
              epoch,
              generation,
              onBootstrapStatus,
              log,
            );
          }),
          map(() => undefined),
          catchError((error: unknown) => {
            const message =
              error instanceof Error ? error.message : String(error);
            if (this.isSessionActive(epoch, generation)) {
              this.setupStatusSignal.set('failed');
              log(`[コンソール] 接続後の初期化に失敗しました: ${message}`);
            }
            return throwError(() => error);
          }),
          shareReplay({ bufferSize: 1, refCount: true }),
        );

        return this.activeBootstrap$;
      }),
    );
  }
}
