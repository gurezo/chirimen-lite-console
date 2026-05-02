/** Full rewrite (#606). Pi Zero bootstrap; I/O via {@link SerialFacadeService} / `SerialSession` v2.3.1. */
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
  timer,
} from 'rxjs';
import {
  PI_ZERO_ENVIRONMENT_STEPS,
  PI_ZERO_PROMPT_TARGET,
} from './pi-zero-bootstrap.config';
import { PiZeroPromptDetectorService } from './pi-zero-prompt-detector.service';
import { SerialFacadeService } from './serial-facade.service';

export type PiZeroBootstrapStatusHandler = (line: string) => void;
/** `pending` = getty の中間メッセージ（Login incorrect 等）で次のプロンプト行を待つ */
type AuthState = 'shell' | 'login' | 'password' | 'pending';
interface AuthLoopState {
  stepCount: number;
  loginSendCount: number;
  passwordSendCount: number;
}
const SHELL_READINESS_TIMEOUT_MESSAGE =
  'Shell readiness timeout while waiting for prompt';

/**
 * Pi Zero / CHIRIMEN 固有のシリアル初期化を集約する単一サービス（issue #594）。
 *
 * 本サービスは次の四責務を担い、他サービスからは Pi Zero ロジックを排除する。
 *
 *   1. **シェルプロンプト到達確認**（{@link probeShellPrompt$}）
 *   2. **ログイン**（{@link loginSequence$}, ID 送信）
 *   3. **パスワード送信**（{@link sendPasswordAndAwaitShell$}）
 *   4. **環境初期化**（{@link environmentSequence$}）
 *
 * シリアル送受信そのものは {@link SerialFacadeService}（`@gurezo/web-serial-rxjs` の
 * `SerialSession` を内包）、接続単位での「一度だけ実行」などのオーケストレーションは
 * {@link PiZeroSessionService} が担う。
 *
 * 接続直後のコンソール遷移（`login:` → `Password:` → シェルプロンプト）の受け入れ基準は
 * [Issue #606](https://github.com/gurezo/chirimen-lite-console/issues/606) を参照。
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
    return this.environmentSequence$(log);
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
      switchMap(() =>
        this.runAuthLoop$(log, {
          stepCount: 0,
          loginSendCount: 0,
          passwordSendCount: 0,
        }),
      ),
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
      // `isLoginPrompt` / `isPasswordPrompt` はバッファ「どこか」の一致のため、ユーザー名送信後も
      // スクロールバックの login: だけで即完了し「Login rejected」になる。末尾行ベースのみ使う。
      promptMatch: (buf) =>
        this.promptDetector.isAwaitingLoginName(buf) ||
        this.promptDetector.isAwaitingPasswordInput(buf) ||
        this.promptDetector.isLikelyLoggedInShellPrompt(buf) ||
        this.trailingLineLooksLikeGettyAuthMessage(buf),
      // getty が遅い／MOTD が長いと LONG では間に合わないことがある。lone \r で行が未完の間も検出できるよう時間に余裕を持つ。
      timeout: SERIAL_TIMEOUT.FILE_TRANSFER,
    }).pipe(map(({ stdout }) => this.classifyAuthState(stdout)));
  }

  /**
   * getty が lone `\r` でプロンプトを更新した直後は lines$ に載るまで遅れることがあるため、
   * 1 回だけ改行を再送して認証状態待ちを再試行する。
   */
  private waitForAuthState$(): Observable<AuthState> {
    return this.awaitAuthState$().pipe(
      catchError((error) => {
        if (!this.isTimeoutError(error)) {
          throw error;
        }
        // getty の lone CR で行イベントが未確定な場合に 1 度だけ改行を打って再判定する。
        return this.serial.send$('\r\n').pipe(
          switchMap(() => this.awaitAuthState$()),
          catchError((retryError) => {
            if (!this.isTimeoutError(retryError)) {
              throw retryError;
            }
            throw new Error(SHELL_READINESS_TIMEOUT_MESSAGE);
          }),
        );
      }),
    );
  }

  private isTimeoutError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /timeout/i.test(message);
  }

  /**
   * getty の「現在の」入力待ちは末尾行で見る（{@link PiZeroPromptDetectorService} と同じ方針）。
   *
   * **パスワード成功直後**は MOTD などで手前に `raspberrypi login:` が残り、末尾行だけを見る
   * `isAwaitingLoginName` が先に true になり得る。末尾が対話シェルなら **login より shell を優先**する。
   */
  private classifyAuthState(stdout: string): AuthState {
    const text = typeof stdout === 'string' ? stdout : '';
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const tail = this.trailingNonEmptyLine(normalized);

    if (this.promptDetector.isAwaitingPasswordInput(normalized)) {
      return 'password';
    }
    if (tail.length > 0 && this.promptDetector.isLikelyLoggedInShellPrompt(tail)) {
      return 'shell';
    }
    if (this.promptDetector.isAwaitingLoginName(normalized)) {
      return 'login';
    }
    if (this.promptDetector.isLikelyLoggedInShellPrompt(normalized)) {
      return 'shell';
    }
    if (this.trailingLineLooksLikeGettyAuthMessage(normalized)) {
      return 'pending';
    }
    return 'pending';
  }

  private trailingNonEmptyLine(text: string): string {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const t = lines[i]?.trim();
      if (t && t.length > 0) {
        return t;
      }
    }
    return '';
  }

  /**
   * パスワード直後の "Login incorrect" / タイムアウト表示など。プロンプト行ではないが read を進める。
   */
  private trailingLineLooksLikeGettyAuthMessage(buf: string): boolean {
    const line = this.trailingNonEmptyLine(buf);
    if (!line) {
      return false;
    }
    return (
      /login incorrect/i.test(line) ||
      /authentication failure/i.test(line) ||
      /login timed out/i.test(line) ||
      /maximum\s+number\s+of\s+attempts/i.test(line)
    );
  }

  private runAuthLoop$(
    log: PiZeroBootstrapStatusHandler,
    state: AuthLoopState,
  ): Observable<void> {
    if (state.stepCount >= 8) {
      throw new Error('Authentication flow exceeded retry budget');
    }
    return this.waitForAuthState$().pipe(
      switchMap((authState) => {
        if (authState === 'pending') {
          return timer(250).pipe(
            switchMap(() =>
              this.runAuthLoop$(log, {
                stepCount: state.stepCount + 1,
                loginSendCount: state.loginSendCount,
                passwordSendCount: state.passwordSendCount,
              }),
            ),
          );
        }
        if (authState === 'shell') {
          if (state.stepCount > 0) {
            log('[コンソール] ログインが完了しました。');
          } else {
            log('[コンソール] すでにログイン済みのシェルを検出しました。');
          }
          return of(undefined);
        }
        if (authState === 'login') {
          // ユーザー名送信後まだパスワードを送っていないのに再度 login: → 拒否
          if (state.loginSendCount >= 1 && state.passwordSendCount === 0) {
            throw new Error('Login rejected after username submission');
          }
          // パスワード送信後に再度 login:（誤パスワード等）
          if (state.loginSendCount >= 1 && state.passwordSendCount >= 1) {
            throw new Error('Password authentication failed');
          }
          log(`[コンソール] ログインユーザー「${PI_ZERO_LOGIN_USER}」を送信中...`);
          return this.serial.send$(`${PI_ZERO_LOGIN_USER}\r\n`).pipe(
            switchMap(() =>
              this.runAuthLoop$(log, {
                stepCount: state.stepCount + 1,
                loginSendCount: state.loginSendCount + 1,
                passwordSendCount: state.passwordSendCount,
              }),
            ),
          );
        }
        if (state.passwordSendCount >= 2) {
          throw new Error('Password authentication failed');
        }
        if (state.loginSendCount === 0) {
          log(
            '[コンソール] パスワード入力画面を検出しました（ユーザー名入力は省略します）。',
          );
        }
        log('[コンソール] パスワードを送信中（画面には表示しません）...');
        return this.serial.send$(`${PI_ZERO_LOGIN_PASSWORD}\r\n`).pipe(
          switchMap(() => this.serial.send$('\r\n')),
          switchMap(() =>
            this.runAuthLoop$(log, {
              stepCount: state.stepCount + 1,
              loginSendCount: state.loginSendCount,
              passwordSendCount: state.passwordSendCount + 1,
            }),
          ),
        );
      }),
    );
  }

  // --- (4) 環境初期化 ---------------------------------------------------------

  private environmentSequence$(
    log: PiZeroBootstrapStatusHandler,
  ): Observable<void> {
    log('[コンソール] 環境設定の初期化を開始します。');
    return from(PI_ZERO_ENVIRONMENT_STEPS).pipe(
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
              const highlightedLine = cleaned
                .split(/\n/)
                .map((line) => line.trim())
                .find((line) => /^Time zone:|^(LANG|LC_ALL|TZ)=/i.test(line));
              if (highlightedLine) {
                log(`[コンソール] 現在の設定: ${highlightedLine}`);
              }
              for (const line of cleaned.split(/\n/)) {
                const t = line.trim();
                if (t.length === 0) {
                  continue;
                }
                if (highlightedLine && t === highlightedLine) {
                  continue;
                }
                log(line);
              }
            }),
            catchError((error: unknown) => {
              const message =
                error instanceof Error ? error.message : String(error);
              log(
                `[コンソール] 環境設定初期化コマンドに失敗しました: ${step.command} (${message})`,
              );
              throw new Error(
                `Environment setup failed at "${step.command}": ${message}`,
              );
            }),
          );
      }),
      ignoreElements(),
      defaultIfEmpty(undefined),
      tap(() =>
        log('[コンソール] 環境設定の初期化が完了しました。'),
      ),
      map(() => undefined),
    );
  }
}
