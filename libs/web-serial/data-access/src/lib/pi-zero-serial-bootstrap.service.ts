import { Injectable } from '@angular/core';
import {
  type ConnectClient,
  createConnectClient,
} from '@libs-connect-util';
import { sanitizeSerialStdout } from '@libs-terminal-util';
import {
  PI_ZERO_LOGIN_PASSWORD,
  PI_ZERO_LOGIN_USER,
  PI_ZERO_SERIAL_LOGIN_LINE_PATTERN,
  PI_ZERO_SERIAL_PASSWORD_LINE_PATTERN,
  PI_ZERO_SHELL_PROMPT_LINE_PATTERN,
  SERIAL_TIMEOUT,
} from '@libs-web-serial-util';
import type { Observable } from 'rxjs';
import {
  catchError,
  concatMap,
  defaultIfEmpty,
  defer,
  finalize,
  from,
  ignoreElements,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { PiZeroShellReadinessService } from './pi-zero-shell-readiness.service';
import { SerialFacadeService } from './serial-facade.service';

export type PiZeroBootstrapStatusHandler = (line: string) => void;

@Injectable({
  providedIn: 'root',
})
export class PiZeroSerialBootstrapService {
  private lastBootstrappedEpoch = -1;
  /** 同一 connectionEpoch でのブートストラップ多重起動を防ぐ */
  private activeBootstrap$: Observable<void> | null = null;
  private activeBootstrapEpoch: number | null = null;

  constructor(
    private readonly serial: SerialFacadeService,
    private readonly shellReadiness: PiZeroShellReadinessService,
  ) {}

  /**
   * 接続セッションごとに1回、シェル到達（必要ならログイン）と接続直後の初期化を行う。
   */
  shouldRunAfterConnect(): boolean {
    if (!this.serial.isConnected()) {
      return false;
    }
    const epoch = this.serial.getConnectionEpoch();
    if (epoch === this.lastBootstrappedEpoch) {
      return false;
    }
    return true;
  }

  /**
   * 接続セッション内で未初期化の場合のみ初期化パイプラインを実行する。
   */
  runAfterConnect$(
    onStatus?: PiZeroBootstrapStatusHandler,
  ): Observable<void> {
    const log = onStatus ?? (() => undefined);

    if (!this.shouldRunAfterConnect()) {
      return of(undefined);
    }
    const epoch = this.serial.getConnectionEpoch();

    if (
      this.activeBootstrap$ !== null &&
      this.activeBootstrapEpoch === epoch
    ) {
      return this.activeBootstrap$;
    }

    this.activeBootstrapEpoch = epoch;

    this.activeBootstrap$ = defer(() => this.runPipeline$(log)).pipe(
      tap(() => {
        if (this.serial.isConnected()) {
          this.lastBootstrappedEpoch = epoch;
          this.shellReadiness.setReady(true);
        }
      }),
      map(() => undefined),
      catchError((error: unknown) => {
        const message =
          error instanceof Error ? error.message : String(error);
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
  }

  private runPipeline$(log: PiZeroBootstrapStatusHandler): Observable<void> {
    const client = createConnectClient();

    return this.serial.readUntilPrompt$({
      prompt: PI_ZERO_SHELL_PROMPT_LINE_PATTERN,
      timeout: SERIAL_TIMEOUT.SHELL_PROMPT_PROBE,
    }).pipe(
      map(() => true),
      catchError(() => of(false)),
      switchMap((atShell) =>
        atShell ? of(undefined) : this.loginSequence$(log),
      ),
      switchMap(() => this.timezoneSequence$(log, client)),
    );
  }

  private loginSequence$(log: PiZeroBootstrapStatusHandler): Observable<void> {
    log('[コンソール] ログイン画面を検出しました。');
    return this.serial
      .readUntilPrompt$({
        prompt: PI_ZERO_SERIAL_LOGIN_LINE_PATTERN,
        // 起動直後のログ出しが続くと login: 行が遅延することがある
        timeout: SERIAL_TIMEOUT.LONG,
      })
      .pipe(
        tap(() => {
          log(
            `[コンソール] ログインユーザー「${PI_ZERO_LOGIN_USER}」を送信中...`,
          );
        }),
        switchMap(() =>
          this.serial.exec$(PI_ZERO_LOGIN_USER, {
            prompt: PI_ZERO_SERIAL_PASSWORD_LINE_PATTERN,
            timeout: SERIAL_TIMEOUT.DEFAULT,
            retry: 1,
          }),
        ),
        tap(() => {
          log('[コンソール] パスワードを送信中（画面には表示しません）...');
        }),
        switchMap(() =>
          this.serial.exec$(PI_ZERO_LOGIN_PASSWORD, {
            prompt: PI_ZERO_SHELL_PROMPT_LINE_PATTERN,
            timeout: SERIAL_TIMEOUT.LONG,
            retry: 1,
          }),
        ),
        tap(() => log('[コンソール] ログインが完了しました。')),
        map(() => undefined),
      );
  }

  private timezoneSequence$(
    log: PiZeroBootstrapStatusHandler,
    client: ConnectClient,
  ): Observable<void> {
    log('[コンソール] タイムゾーン関連の初期化を開始します。');
    return from(client.timezoneSteps).pipe(
      concatMap((step) => {
        log(step.statusMessage);
        return this.serial
          .exec$(step.command, {
            prompt: PI_ZERO_SHELL_PROMPT_LINE_PATTERN,
            timeout: SERIAL_TIMEOUT.SHORT,
          })
          .pipe(
            tap(({ stdout }) => {
              const cleaned = sanitizeSerialStdout(
                typeof stdout === 'string' ? stdout : '',
                step.command,
                client.prompt,
              );
              for (const line of cleaned.split(/\r?\n/)) {
                if (line.length > 0) {
                  log(line);
                }
              }
            }),
            catchError((error: unknown) => {
              const message =
                error instanceof Error ? error.message : String(error);
              log(`[コンソール] コマンドが失敗しました: ${message}`);
              console.warn(`Initial command failed: ${step.command}`, error);
              return of(undefined);
            }),
          );
      }),
      ignoreElements(),
      defaultIfEmpty(undefined),
      tap(() =>
        log('[コンソール] タイムゾーン関連の初期化が完了しました。'),
      ),
      map(() => undefined),
    );
  }
}
