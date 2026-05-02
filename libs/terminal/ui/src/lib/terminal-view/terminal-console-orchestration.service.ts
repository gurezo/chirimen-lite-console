import { Injectable, inject } from '@angular/core';
import {
  PiZeroSessionService,
  SerialFacadeService,
} from '@libs-web-serial-data-access';
import { SERIAL_TIMEOUT } from '@libs-web-serial-util';
import { coerceLsForSerialListing, sanitizeSerialStdout } from '@libs-terminal-util';
import {
  EMPTY,
  Observable,
  catchError,
  filter,
  finalize,
  firstValueFrom,
  shareReplay,
  switchMap,
  take,
  tap,
} from 'rxjs';

export interface TerminalConsoleSink {
  writeln(line: string): void;
  write(chunk: string): void;
}

/**
 * ターミナル画面向けにシリアル接続・Pi Zero bootstrap・exec を束ねる（issue #563）。
 * prompt / timeout / sanitize はここに集約し、component は表示用 sink と購読のみに寄せる。
 *
 * ### ライブ表示の経路（issue #610 / 親 #609）
 *
 * Issue #610 以降、ライブ表示は {@link TerminalViewComponent} 側で
 * {@link SerialFacadeService#terminalText$} を直接購読し、累積全文との差分のみを
 * xterm に書き込む方式に移行した。`terminalText$` はライブラリ内で `\r` 再描画を
 * 畳んだ累積全文を emit するため、そのまま `write` すると二重表示になる点に注意する。
 *
 * ### 生受信ミラー（issue #566 / #610 で停止）
 *
 * 旧来は本サービスの {@link #pipeTerminalOutputToSink$} が
 * {@link SerialFacadeService#receive$} の生チャンクを xterm にミラーしていた。
 * Issue #610 で UI 側購読を停止し、シグネチャと spec のみ温存している
 * （親 #609 配下の後続サブ issue で本メソッド自体を削除予定）。
 *
 * ### 対話コンソール表示
 *
 * キーボード入力は issue #611 以降 {@link SerialFacadeService#send$} で生送信し、
 * 表示は {@link SerialFacadeService#terminalText$} に任せる。
 * ツールバー経由の {@link SerialFacadeService#exec$} ではライブミラーを抑止し、完了後の
 * {@link sanitizeSerialStdout} 結果だけを xterm に出して二重表示を避ける。
 */
@Injectable({
  providedIn: 'root',
})
export class TerminalConsoleOrchestrationService {
  private readonly serial = inject(SerialFacadeService);
  private readonly piZeroSession = inject(PiZeroSessionService);
  private activeBootstrap$: Observable<void> | null = null;
  private activeBootstrapEpoch: number | null = null;
  /** bootstrap / exec 中は 0 より大きくし、{@link #pipeTerminalOutputToSink$} を止める */
  private terminalMirrorSuppressDepth = 0;

  /** 対話入力とツールバー経由の exec を直列化する */
  private execTail: Promise<void> = Promise.resolve();

  readonly connectionEstablished$ = this.serial.connectionEstablished$;
  readonly isConnected$ = this.serial.isConnected$;

  private enqueueExec<T>(job: () => Promise<T>): Promise<T> {
    const run = this.execTail.then(() => job());
    this.execTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /**
   * キーボードから入力されたコマンドをシリアルへ送る（issue #611）。
   * 改行は {@link SerialFacadeService#send$} 用ペイロードに `\n` を付与する。
   * 表示は {@link SerialFacadeService#terminalText$} 側のため、戻り値は空文字。
   *
   * @param _remotePrompt 互換のため残す（プロンプト待ちは行わない）
   */
  runInteractiveCommand(command: string, _remotePrompt: string): Promise<string> {
    return this.enqueueExec(async () => {
      const payload = `${coerceLsForSerialListing(command)}\n`;
      await firstValueFrom(this.serial.send$(payload));
      return '';
    });
  }

  /**
   * ツールバー等から要求されたコマンドを実行する。
   */
  async runToolbarCommand(
    cmd: string,
    remotePrompt: string,
  ): Promise<
    | { status: 'success'; output: string }
    | { status: 'not_connected' }
    | { status: 'error'; message: string }
  > {
    return this.enqueueExec(async () => {
      const connected = await firstValueFrom(
        this.serial.isConnected$.pipe(take(1)),
      );
      if (!connected) {
        return { status: 'not_connected' };
      }
      this.terminalMirrorSuppressDepth++;
      try {
        const send = coerceLsForSerialListing(cmd);
        const { stdout } = await firstValueFrom(
          this.serial.exec$(send, {
            prompt: remotePrompt,
            timeout: SERIAL_TIMEOUT.DEFAULT,
          }),
        );
        const output = sanitizeSerialStdout(stdout, send, remotePrompt);
        return { status: 'success', output };
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);
        return { status: 'error', message };
      } finally {
        this.terminalMirrorSuppressDepth--;
      }
    });
  }

  /**
   * 接続確立後の Pi Zero 初期化。表示は {@link TerminalConsoleSink} に委譲する。
   */
  bootstrapAfterConnect$(
    prefixMessage: string,
    sink: TerminalConsoleSink,
  ): Observable<void> {
    const epoch = this.serial.getConnectionEpoch();
    if (this.activeBootstrap$ !== null && this.activeBootstrapEpoch === epoch) {
      return this.activeBootstrap$;
    }
    this.activeBootstrapEpoch = epoch;
    this.activeBootstrap$ = this.piZeroSession.shouldRunAfterConnect$().pipe(
      switchMap((should) => {
        this.terminalMirrorSuppressDepth++;
        if (!should) {
          this.writeConsoleLine(sink, `${prefixMessage} 初期化済みのためスキップします。`);
          return EMPTY;
        }
        this.writeConsoleLine(sink, `${prefixMessage} 初期化しています...`);
        return this.piZeroSession.runAfterConnect$((line) =>
          this.writeConsoleLine(sink, line),
        );
      }),
      catchError(() => EMPTY),
      finalize(() => {
        this.terminalMirrorSuppressDepth--;
        sink.write('\r\n$ ');
        if (this.activeBootstrapEpoch === epoch) {
          this.activeBootstrap$ = null;
          this.activeBootstrapEpoch = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    return this.activeBootstrap$;
  }

  /**
   * {@link SerialFacadeService#receive$} の UTF-8 チャンクを xterm 等へそのまま流す（TTY 相当）。
   * プロンプト判定・コマンド結果の行処理には使わないこと。
   *
   * @deprecated Issue #610 でライブ表示は {@link SerialFacadeService#terminalText$} 直購読に
   * 移行済み。UI 側からは購読されておらず、親 issue #609 配下の後続サブ issue で削除予定。
   */
  pipeTerminalOutputToSink$(
    sink: Pick<TerminalConsoleSink, 'write'>,
  ): Observable<string> {
    return this.serial.receive$.pipe(
      filter(() => this.terminalMirrorSuppressDepth === 0),
      tap((chunk) => sink.write(chunk)),
    );
  }

  private writeConsoleLine(sink: TerminalConsoleSink, line: string): void {
    sink.write(`\r\n${line}\r\n`);
  }
}
