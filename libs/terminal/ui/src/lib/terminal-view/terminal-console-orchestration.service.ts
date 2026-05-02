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
 * ### 生受信ミラー（issue #566）
 *
 * シリアルからの **ライブ表示** は {@link SerialFacadeService#receive$} の生チャンクを xterm に流す。
 * `terminalText$` はライブラリが畳んだ**累積全文**を出すため、そのまま `write` すると二重表示になる。
 * {@link #pipeTerminalOutputToSink$} が `receive$` 経路。`exec` の stdout 整形表示とは別。
 *
 * ### 対話コンソール表示
 *
 * ライブ表示は `receive$` の購読で行う。`exec$` 経路（対話・ツールバー）ではミラーを止め、
 * 完了後の {@link sanitizeSerialStdout} 結果だけを xterm に出して二重表示を避ける。
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
   * キーボードから入力されたコマンドを実行し、表示用に整形した stdout を返す。
   */
  runInteractiveCommand(command: string, remotePrompt: string): Promise<string> {
    return this.enqueueExec(async () => {
      this.terminalMirrorSuppressDepth++;
      try {
        const send = coerceLsForSerialListing(command);
        const { stdout } = await firstValueFrom(
          this.serial.exec$(send, {
            prompt: remotePrompt,
            timeout: SERIAL_TIMEOUT.DEFAULT,
          }),
        );
        return sanitizeSerialStdout(stdout, send, remotePrompt);
      } finally {
        this.terminalMirrorSuppressDepth--;
      }
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
