import { Injectable, inject } from '@angular/core';
import {
  PiZeroSessionService,
  SerialFacadeService,
} from '@libs-web-serial-data-access';
import { coerceLsForSerialListing } from '@libs-terminal-util';
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
 * ターミナル画面向けにシリアル接続・Pi Zero bootstrap・送信を束ねる（issue #563）。
 * 対話・ツールバーとも {@link SerialFacadeService#send$} で送信し、表示は
 * {@link SerialFacadeService#terminalText$} に任せる（issue #610 / #611 / #612）。
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
 * ### 対話・ツールバー（issue #611 / #612）
 *
 * キーボード入力もツールバー経由のコマンドも {@link SerialFacadeService#send$} で
 * 送信する。完了待ちや stdout の切り出しは行わず、シェル出力は
 * {@link SerialFacadeService#terminalText$} 側のストリームに任せる。
 *
 * ### stdout 整形（issue #613）
 *
 * `sanitizeSerialStdout`（@libs-terminal-util）のような exec キャプチャ向けの stdout
 * 整形は、ターミナル UI 経路では使用しない（送信のみ・表示は `terminalText$`）。
 */
@Injectable({
  providedIn: 'root',
})
export class TerminalConsoleOrchestrationService {
  private readonly serial = inject(SerialFacadeService);
  private readonly piZeroSession = inject(PiZeroSessionService);
  private activeBootstrap$: Observable<void> | null = null;
  private activeBootstrapEpoch: number | null = null;
  /** bootstrap 中は 0 より大きくし、{@link #pipeTerminalOutputToSink$} を止める */
  private terminalMirrorSuppressDepth = 0;

  readonly connectionEstablished$ = this.serial.connectionEstablished$;
  readonly isConnected$ = this.serial.isConnected$;

  /**
   * キーボードから入力されたコマンドをシリアルへ送る（issue #611）。
   * 改行は {@link SerialFacadeService#send$} 用ペイロードに `\n` を付与する。
   * 表示は {@link SerialFacadeService#terminalText$} 側のため、戻り値は空文字。
   */
  async runInteractiveCommand(command: string): Promise<string> {
    const payload = `${coerceLsForSerialListing(command)}\n`;
    await firstValueFrom(this.serial.send$(payload));
    return '';
  }

  /**
   * ツールバー等から要求されたコマンドを {@link SerialFacadeService#send$} で送る（issue #612）。
   * シェル側の完了や stdout の取得は行わず、表示は {@link SerialFacadeService#terminalText$} に任せる。
   */
  async runToolbarCommand(cmd: string): Promise<
    | { status: 'success'; output: string }
    | { status: 'not_connected' }
    | { status: 'error'; message: string }
  > {
    const connected = await firstValueFrom(
      this.serial.isConnected$.pipe(take(1)),
    );
    if (!connected) {
      return { status: 'not_connected' };
    }
    try {
      const payload = `${coerceLsForSerialListing(cmd)}\n`;
      await firstValueFrom(this.serial.send$(payload));
      return { status: 'success', output: '' };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      return { status: 'error', message };
    }
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
