import { Injectable } from '@angular/core';
import {
  type ConnectClient,
  createConnectClient,
} from '@libs-connect-util';
import { sanitizeSerialStdout } from '@libs-terminal-util';
import {
  PI_ZERO_LOGIN_PASSWORD,
  PI_ZERO_LOGIN_USER,
  SERIAL_TIMEOUT,
} from '@libs-web-serial-util';
import type { Observable } from 'rxjs';
import {
  catchError,
  concatMap,
  defaultIfEmpty,
  from,
  ignoreElements,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { SerialPromptDetectorService } from './serial-command/serial-prompt-detector.service';
import { SerialFacadeService } from './serial-facade.service';

export type PiZeroBootstrapStatusHandler = (line: string) => void;

/**
 * Pi Zero / CHIRIMEN 向けのログイン・環境初期化パイプライン（シリアル送受信は {@link SerialFacadeService}）。
 *
 * 接続単位での「一度だけ実行」などのオーケストレーションは {@link PiZeroSessionService}。
 */
@Injectable({
  providedIn: 'root',
})
export class PiZeroSerialBootstrapService {
  constructor(
    private readonly serial: SerialFacadeService,
    private readonly promptDetector: SerialPromptDetectorService,
  ) {}

  /**
   * シェルプロンプト到達確認。未到達ならログイン（ID / Password）まで実行する。
   */
  loginIfNeeded$(
    onStatus?: PiZeroBootstrapStatusHandler,
  ): Observable<void> {
    const log = onStatus ?? (() => undefined);
    return this.loginPhase$(log);
  }

  /**
   * タイムゾーン等の初期化コマンドを実行する（シェル到達済みを前提）。
   */
  setupEnvironment$(
    onStatus?: PiZeroBootstrapStatusHandler,
  ): Observable<void> {
    const log = onStatus ?? (() => undefined);
    const client = createConnectClient();
    return this.timezoneSequence$(log, client);
  }

  /**
   * ログイン（必要なら）後に環境セットアップを続けて実行する。
   * 接続エポックの重複抑止は {@link PiZeroSessionService#runAfterConnect$} 側。
   */
  runPostConnectPipeline$(
    onStatus?: PiZeroBootstrapStatusHandler,
  ): Observable<void> {
    const log = onStatus ?? (() => undefined);
    return this.loginPhase$(log).pipe(
      switchMap(() => this.setupEnvironment$(onStatus)),
    );
  }

  private loginPhase$(log: PiZeroBootstrapStatusHandler): Observable<void> {
    return this.serial
      .readUntilPrompt$({
        prompt: '',
        promptMatch: (buf) => this.promptDetector.isShellPrompt(buf),
        timeout: SERIAL_TIMEOUT.SHELL_PROMPT_PROBE,
      })
      .pipe(
        map(() => true),
        catchError(() => of(false)),
        switchMap((atShell) =>
          atShell ? of(undefined) : this.loginSequence$(log),
        ),
      );
  }

  private loginSequence$(log: PiZeroBootstrapStatusHandler): Observable<void> {
    log('[コンソール] ログイン画面を検出しました。');
    return this.serial
      .readUntilPrompt$({
        prompt: '',
        promptMatch: (buf) => this.promptDetector.isLoginPrompt(buf),
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
            prompt: '',
            promptMatch: (buf) => this.promptDetector.isPasswordPrompt(buf),
            timeout: SERIAL_TIMEOUT.DEFAULT,
            retry: 1,
          }),
        ),
        tap(() => {
          log('[コンソール] パスワードを送信中（画面には表示しません）...');
        }),
        switchMap(() =>
          this.serial.exec$(PI_ZERO_LOGIN_PASSWORD, {
            prompt: '',
            promptMatch: (buf) => this.promptDetector.isShellPrompt(buf),
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
            prompt: '',
            promptMatch: (buf) => this.promptDetector.isShellPrompt(buf),
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
