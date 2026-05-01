import { Injectable } from '@angular/core';
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
import {
  PI_ZERO_PROMPT_TARGET,
  PI_ZERO_TIMEZONE_STEPS,
} from './pi-zero-bootstrap.config';
import { PiZeroPromptDetectorService } from './pi-zero-prompt-detector.service';
import { SerialFacadeService } from './serial-facade.service';

export type PiZeroBootstrapStatusHandler = (line: string) => void;
type AuthState = 'shell' | 'login' | 'password';

/**
 * Pi Zero / CHIRIMEN 固有のシリアル初期化を集約する単一サービス（issue #594）。
 *
 * 本サービスは次の四責務を担い、他サービスからは Pi Zero ロジックを排除する。
 *
 *   1. **シェルプロンプト到達確認**（{@link probeShellPrompt$}）
 *   2. **ログイン**（{@link loginSequence$}, ID 送信）
 *   3. **パスワード送信**（{@link sendPasswordAndAwaitShell$}）
 *   4. **timezone 初期化**（{@link timezoneSequence$}）
 *
 * シリアル送受信そのものは {@link SerialFacadeService}、接続単位での「一度だけ実行」
 * などのオーケストレーションは {@link PiZeroSessionService} が担う。
 */
@Injectable({
  providedIn: 'root',
})
export class PiZeroSerialBootstrapService {
  constructor(
    private readonly serial: SerialFacadeService,
    private readonly promptDetector: PiZeroPromptDetectorService,
  ) {}

  /**
   * シェルプロンプト到達確認を行い、未到達ならログイン（ID / Password）まで実行する。
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
    return this.timezoneSequence$(log);
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

  // --- (1) プロンプト到達確認 -----------------------------------------------

  /**
   * シェルプロンプトに既に到達しているかを軽く確認する。
   * 未到達（タイムアウト等）なら呼び出し側が login フェーズへフォールバックする。
   */
  private probeShellPrompt$(): Observable<boolean> {
    return this.serial
      .readUntilPrompt$({
        prompt: '',
        promptMatch: (buf) =>
          this.promptDetector.isLikelyLoggedInShellPrompt(buf),
        timeout: SERIAL_TIMEOUT.SHELL_PROMPT_PROBE,
      })
      .pipe(
        map(() => true),
        catchError(() => of(false)),
      );
  }

  private loginPhase$(log: PiZeroBootstrapStatusHandler): Observable<void> {
    return this.probeShellPrompt$().pipe(
      switchMap((atShell) =>
        atShell ? of(undefined) : this.loginSequence$(log),
      ),
    );
  }

  // --- (2) ログイン（ID 送信）/ (3) パスワード送信 --------------------------

  private loginSequence$(log: PiZeroBootstrapStatusHandler): Observable<void> {
    log('[コンソール] ログイン画面を検出しました。');
    // getty はプロンプト末尾を CR のみにすることが多く、web-serial-rxjs の行分割では
    // 末尾が lone \r のとき行が emit されない。改行を送って確定させる。
    return this.clearPromptBuffer$().pipe(
      switchMap(() => this.serial.send$('\r\n')),
      switchMap(() => this.awaitAuthState$()),
      switchMap((state) => {
        if (state === 'shell') {
          log('[コンソール] すでにログイン済みのシェルを検出しました。');
          return of(undefined);
        }
        if (state === 'password') {
          log(
            '[コンソール] パスワード入力画面を検出しました（ユーザー名入力は省略します）。',
          );
          log('[コンソール] パスワードを送信中（画面には表示しません）...');
          return this.sendPasswordAndAwaitShell$().pipe(
            tap(() => log('[コンソール] ログインが完了しました。')),
          );
        }
        return this.sendLoginUserAndPassword$(log).pipe(
          tap(() => log('[コンソール] ログインが完了しました。')),
        );
      }),
      map(() => undefined),
    );
  }

  /**
   * 以前の読み取りで残った行バッファが誤判定を起こさないよう、login 判定前に drain する。
   */
  private clearPromptBuffer$(): Observable<void> {
    return this.serial
      .readUntilPrompt$({
        prompt: '',
        waitForPrompt: false,
        timeout: SERIAL_TIMEOUT.SHORT,
      })
      .pipe(
        map(() => undefined),
        catchError(() => of(undefined)),
      );
  }

  private awaitAuthState$(): Observable<AuthState> {
    return this.serial.readUntilPrompt$({
      prompt: '',
      promptMatch: (buf) =>
        this.promptDetector.isAwaitingLoginName(buf) ||
        this.promptDetector.isAwaitingPasswordInput(buf) ||
        this.promptDetector.isLikelyLoggedInShellPrompt(buf),
      // getty が遅い／MOTD が長いと LONG では間に合わないことがある。lone \r で行が未完の間も検出できるよう時間に余裕を持つ。
      timeout: SERIAL_TIMEOUT.FILE_TRANSFER,
    }).pipe(map(({ stdout }) => this.classifyAuthState(stdout)));
  }

  private classifyAuthState(stdout: string): AuthState {
    const text = typeof stdout === 'string' ? stdout : '';
    if (this.promptDetector.isLikelyLoggedInShellPrompt(text)) {
      return 'shell';
    }
    if (this.promptDetector.isAwaitingPasswordInput(text)) {
      return 'password';
    }
    return 'login';
  }

  private sendLoginUserAndPassword$(
    log: PiZeroBootstrapStatusHandler,
  ): Observable<void> {
    log(`[コンソール] ログインユーザー「${PI_ZERO_LOGIN_USER}」を送信中...`);
    return this.serial.send$(`${PI_ZERO_LOGIN_USER}\r\n`).pipe(
      switchMap(() =>
        this.serial.readUntilPrompt$({
          prompt: '',
          promptMatch: (buf) =>
            this.promptDetector.isAwaitingPasswordInput(buf) ||
            this.promptDetector.isAwaitingLoginName(buf) ||
            this.promptDetector.isLikelyLoggedInShellPrompt(buf),
          timeout: SERIAL_TIMEOUT.LONG,
        }),
      ),
      map(({ stdout }) => this.classifyAuthState(stdout)),
      switchMap((state) => {
        if (state === 'shell') {
          return of(undefined);
        }
        if (state === 'password') {
          log('[コンソール] パスワードを送信中（画面には表示しません）...');
          return this.sendPasswordAndAwaitShell$();
        }
        throw new Error('Login rejected after username submission');
      }),
    );
  }

  /**
   * パスワード送出後、その行だけでは pi@ が lines$ に乗らない場合があるので
   * wait を切り、続けて改行送信で getty が出したログイン／シェルを行としてフラッシュしたうえで検出する。
   */
  private sendPasswordAndAwaitShell$(): Observable<void> {
    return this.serial.send$(`${PI_ZERO_LOGIN_PASSWORD}\r\n`).pipe(
      switchMap(() => this.serial.send$('\r\n')),
      switchMap(() =>
        this.serial.readUntilPrompt$({
          prompt: '',
          promptMatch: (buf) =>
            this.promptDetector.isLikelyLoggedInShellPrompt(buf) ||
            this.promptDetector.isAwaitingLoginName(buf) ||
            this.promptDetector.isAwaitingPasswordInput(buf),
          timeout: SERIAL_TIMEOUT.FILE_TRANSFER,
        }),
      ),
      switchMap(({ stdout }) => {
        const state = this.classifyAuthState(stdout);
        if (state === 'shell') {
          return of(undefined);
        }
        throw new Error('Password authentication failed');
      }),
    );
  }

  // --- (4) timezone 初期化 ---------------------------------------------------

  private timezoneSequence$(
    log: PiZeroBootstrapStatusHandler,
  ): Observable<void> {
    log('[コンソール] タイムゾーン関連の初期化を開始します。');
    return from(PI_ZERO_TIMEZONE_STEPS).pipe(
      concatMap((step) => {
        log(step.statusMessage);
        return this.serial
          .exec$(step.command, {
            prompt: '',
            promptMatch: (buf) =>
              this.promptDetector.isLikelyLoggedInShellPrompt(buf),
            timeout: SERIAL_TIMEOUT.SHORT,
          })
          .pipe(
            tap(({ stdout }) => {
              // コンソールログ: 送信コマンドと末尾プロンプト除去。xterm の強 dedent は lineStream で避ける
              const cleaned = sanitizeSerialStdout(
                typeof stdout === 'string' ? stdout : '',
                step.command,
                PI_ZERO_PROMPT_TARGET,
              );
              for (const line of cleaned.split(/\n/)) {
                if (line.trim().length > 0) {
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
