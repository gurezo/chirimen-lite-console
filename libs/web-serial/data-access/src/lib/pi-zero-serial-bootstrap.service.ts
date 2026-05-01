import { Injectable } from '@angular/core';
import { sanitizeSerialStdout } from '@libs-terminal-util';
import {
  PI_ZERO_LOGIN_PASSWORD_STORAGE_KEY,
  PI_ZERO_LOGIN_USER_STORAGE_KEY,
  SERIAL_TIMEOUT,
  resolvePiZeroLoginCredential,
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
type AuthState = 'shell' | 'login' | 'password' | 'rejected';
const MAX_AUTH_CYCLES = 2;
const AUTH_WAIT_PASSWORD_PHASE_TIMEOUT = SERIAL_TIMEOUT.FILE_TRANSFER;
interface AuthLoopState {
  stepCount: number;
  loginSendCount: number;
  passwordSendCount: number;
  waitingPasswordRetryCount: number;
  postPasswordLoginReobserveCount: number;
}
interface AuthWaitOptions {
  includeLoginPrompts?: boolean;
  timeout?: number;
}

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
    return this.serial.send$('\r\n').pipe(
      switchMap(() =>
        this.runAuthLoop$(log, {
          stepCount: 0,
          loginSendCount: 0,
          passwordSendCount: 0,
          waitingPasswordRetryCount: 0,
          postPasswordLoginReobserveCount: 0,
        }),
      ),
    );
  }

  private awaitAuthState$(
    state?: AuthLoopState,
    options?: AuthWaitOptions,
  ): Observable<AuthState> {
    const waitingPasswordAfterUsername =
      (state?.loginSendCount ?? 0) > (state?.passwordSendCount ?? 0);
    const waitingAuthResultAfterPassword = (state?.passwordSendCount ?? 0) > 0;
    const includeLoginPrompts =
      options?.includeLoginPrompts ?? !waitingPasswordAfterUsername;
    const timeout =
      options?.timeout ??
      (waitingPasswordAfterUsername || waitingAuthResultAfterPassword
        ? AUTH_WAIT_PASSWORD_PHASE_TIMEOUT
        : SERIAL_TIMEOUT.SHORT);
    return this.serial.readUntilPrompt$({
      prompt: '',
      promptMatch: (buf) =>
        (includeLoginPrompts && this.promptDetector.isAwaitingLoginName(buf)) ||
        this.promptDetector.isAwaitingPasswordInput(buf) ||
        this.promptDetector.isLikelyLoggedInShellPrompt(buf),
      // username 送信直後は login 再描画が続きやすいため待機を短めにし、
      // それ以外の認証待機は FILE_TRANSFER で余裕を確保する。
      timeout,
    }).pipe(map(({ stdout }) => this.classifyAuthState(stdout)));
  }

  /**
   * getty が lone `\r` でプロンプトを更新した直後は lines$ に載るまで遅れることがあるため、
   * 1 回だけ改行を再送して認証状態待ちを再試行する。
   */
  private awaitAuthStateWithRetry$(state: AuthLoopState): Observable<AuthState> {
    const waitingPasswordAfterUsername =
      state.loginSendCount > state.passwordSendCount;
    return this.awaitAuthState$(state).pipe(
      catchError((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (!/timeout/i.test(message)) {
          throw error;
        }
        // password 待ちフェーズの timeout は、実際にはプロンプト再描画待ちのことがある。
        // 1 回だけ改行再送して再観測し、それでも timeout の場合のみ login 扱いへ戻す。
        return this.serial.send$('\r\n').pipe(
          switchMap(() =>
            waitingPasswordAfterUsername
              ? this.awaitAuthState$(state, {
                  includeLoginPrompts: true,
                  timeout: AUTH_WAIT_PASSWORD_PHASE_TIMEOUT,
                })
              : this.awaitAuthState$(state, {
                  includeLoginPrompts: true,
                  timeout: AUTH_WAIT_PASSWORD_PHASE_TIMEOUT,
                }),
          ),
          catchError((retryError) => {
            const retryMessage =
              retryError instanceof Error
                ? retryError.message
                : String(retryError);
            if (
              waitingPasswordAfterUsername &&
              /timeout/i.test(retryMessage)
            ) {
              // 実機で prompt の揺れが続く場合、再待機でも timeout することがある。
              // ここで login 扱いに戻して再同期シーケンスへ進める。
              return of<AuthState>('login');
            }
            if (!waitingPasswordAfterUsername && /timeout/i.test(retryMessage)) {
              // password 送信後の応答が崩れて観測できない場合も login 側へ戻して再同期する。
              return of<AuthState>('login');
            }
            throw retryError;
          }),
        );
      }),
    );
  }

  private classifyAuthState(stdout: string): AuthState {
    const text = typeof stdout === 'string' ? stdout : '';
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (/(?:^|\n)[^\n]*Login incorrect[^\n]*(?:$|\n)/i.test(normalized)) {
      return 'rejected';
    }
    if (this.promptDetector.isLikelyLoggedInShellPrompt(normalized)) {
      return 'shell';
    }
    if (this.promptDetector.isAwaitingPasswordInput(normalized)) {
      return 'password';
    }
    if (this.promptDetector.isAwaitingLoginName(normalized)) {
      return 'login';
    }
    // 末尾行判定できない崩れたバッファ時のみ、後方互換として弱い判定へフォールバック。
    if (this.lastMatchIndex(/(?:^|\n)[^\n]*[Pp]assword:\s*$/gm, normalized) >= 0) {
      return 'password';
    }
    return 'login';
  }

  private runAuthLoop$(
    log: PiZeroBootstrapStatusHandler,
    state: AuthLoopState,
  ): Observable<void> {
    if (state.stepCount >= 8) {
      throw new Error('Authentication flow exceeded retry budget');
    }
    return this.awaitAuthStateWithRetry$(state).pipe(
      switchMap((authState) => {
        if (authState === 'shell') {
          if (state.stepCount > 0) {
            log('[コンソール] ログインが完了しました。');
          } else {
            log('[コンソール] すでにログイン済みのシェルを検出しました。');
          }
          return of(undefined);
        }
        if (authState === 'login') {
          // username 送信直後に login が見えても旧バッファ残りの可能性がある。
          // まずは何も送らず待機を 1 回だけ継続し、それでも login の場合のみ再試行する。
          if (state.loginSendCount > state.passwordSendCount) {
            if (state.waitingPasswordRetryCount < 1) {
              log(
                '[コンソール] login プロンプトを再検出しました。ユーザー名は再送せず、パスワード入力待ちを継続します。',
              );
              return this.runAuthLoop$(log, {
                stepCount: state.stepCount + 1,
                loginSendCount: state.loginSendCount,
                passwordSendCount: state.passwordSendCount,
                waitingPasswordRetryCount: state.waitingPasswordRetryCount + 1,
                postPasswordLoginReobserveCount:
                  state.postPasswordLoginReobserveCount,
              });
            }
            if (state.loginSendCount >= MAX_AUTH_CYCLES) {
              throw new Error('Login rejected after username submission');
            }
            log(
              '[コンソール] ログイン再要求を検出したため、ユーザー名送信から再試行します。',
            );
            const credentials = resolvePiZeroLoginCredential();
            return this.serial.send$(`${credentials.user}\r\n`).pipe(
              switchMap(() =>
                this.runAuthLoop$(log, {
                  stepCount: state.stepCount + 1,
                  loginSendCount: state.loginSendCount + 1,
                  passwordSendCount: state.passwordSendCount,
                  waitingPasswordRetryCount: 0,
                  postPasswordLoginReobserveCount: 0,
                }),
              ),
            );
          }
          // password 送信後の直後は stale な login 表示が残ることがあるため、
          // 1 回は再観測してから再認証サイクルへ進む。
          if (state.passwordSendCount > 0) {
            if (state.postPasswordLoginReobserveCount < 1) {
              log(
                '[コンソール] login プロンプト再検出を確認中です。追加送信せず再観測します。',
              );
              return this.runAuthLoop$(log, {
                stepCount: state.stepCount + 1,
                loginSendCount: state.loginSendCount,
                passwordSendCount: state.passwordSendCount,
                waitingPasswordRetryCount: 0,
                postPasswordLoginReobserveCount:
                  state.postPasswordLoginReobserveCount + 1,
              });
            }
            if (state.loginSendCount >= MAX_AUTH_CYCLES) {
              throw new Error('Login rejected after username submission');
            }
            log(
              '[コンソール] ログイン再要求を検出したため、ユーザー名送信から再試行します。',
            );
            const credentials = resolvePiZeroLoginCredential();
            return this.serial.send$(`${credentials.user}\r\n`).pipe(
              switchMap(() =>
                this.runAuthLoop$(log, {
                  stepCount: state.stepCount + 1,
                  loginSendCount: state.loginSendCount + 1,
                  passwordSendCount: state.passwordSendCount,
                  waitingPasswordRetryCount: 0,
                  postPasswordLoginReobserveCount: 0,
                }),
              ),
            );
          }
          if (state.loginSendCount >= MAX_AUTH_CYCLES) {
            throw new Error('Login rejected after username submission');
          }
          const credentials = resolvePiZeroLoginCredential();
          log(`[コンソール] ログインユーザー「${credentials.user}」を送信中...`);
          return this.serial.send$(`${credentials.user}\r\n`).pipe(
            switchMap(() =>
              this.runAuthLoop$(log, {
                stepCount: state.stepCount + 1,
                loginSendCount: state.loginSendCount + 1,
                passwordSendCount: state.passwordSendCount,
                waitingPasswordRetryCount: 0,
                postPasswordLoginReobserveCount: 0,
              }),
            ),
          );
        }
        if (authState === 'password') {
          if (state.passwordSendCount >= MAX_AUTH_CYCLES) {
            throw new Error('Password authentication failed');
          }
          if (state.loginSendCount === 0) {
            log(
              '[コンソール] パスワード入力画面を検出しました（ユーザー名入力は省略します）。',
            );
          }
          const credentials = resolvePiZeroLoginCredential();
          log('[コンソール] パスワードを送信中（画面には表示しません）...');
          return this.serial.send$(`${credentials.password}\r\n`).pipe(
            switchMap(() =>
              this.runAuthLoop$(log, {
                stepCount: state.stepCount + 1,
                loginSendCount: state.loginSendCount,
                passwordSendCount: state.passwordSendCount + 1,
                waitingPasswordRetryCount: 0,
                postPasswordLoginReobserveCount: 0,
              }),
            ),
          );
        }
        log(
          '[コンソール] ログインに失敗しました。デバイス側パスワード設定を確認してください。',
        );
        throw new Error(
          `Login rejected by target device (Login incorrect). Please verify PI password. You can override credentials via localStorage keys "${PI_ZERO_LOGIN_USER_STORAGE_KEY}" / "${PI_ZERO_LOGIN_PASSWORD_STORAGE_KEY}".`,
        );
      }),
    );
  }

  private lastMatchIndex(pattern: RegExp, text: string): number {
    let last = -1;
    pattern.lastIndex = 0;
    let m = pattern.exec(text);
    while (m) {
      if (typeof m.index === 'number') {
        last = m.index;
      }
      m = pattern.exec(text);
    }
    return last;
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
