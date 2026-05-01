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
  finalize,
  firstValueFrom,
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
 * シリアルからの **ライブ表示** 専用は {@link SerialFacadeService#terminalText$} のみを購読する。
 * {@link #pipeTerminalOutputToSink$} がその経路。`exec` の stdout 整形表示と二重にならないよう UI 側で使い分けること。
 *
 * ### 対話コンソール表示
 *
 * ライブ表示は `terminalText$` の購読のみで行い、実行結果の表示整形（`exec$` 経路）とは責務を分離する。
 */
@Injectable({
  providedIn: 'root',
})
export class TerminalConsoleOrchestrationService {
  private readonly serial = inject(SerialFacadeService);
  private readonly piZeroSession = inject(PiZeroSessionService);

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
      const send = coerceLsForSerialListing(command);
      const { stdout } = await firstValueFrom(
        this.serial.exec$(send, {
          prompt: remotePrompt,
          timeout: SERIAL_TIMEOUT.DEFAULT,
        }),
      );
      return sanitizeSerialStdout(stdout, send, remotePrompt);
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
    return this.piZeroSession.shouldRunAfterConnect$().pipe(
      switchMap((should) => {
        if (!should) {
          sink.writeln(`${prefixMessage} 初期化済みのためスキップします。`);
          sink.write('$ ');
          return EMPTY;
        }
        sink.writeln(`${prefixMessage} 初期化しています...`);
        return this.piZeroSession.runAfterConnect$((line) => sink.writeln(line));
      }),
      catchError(() => EMPTY),
      finalize(() => sink.write('$ ')),
    );
  }

  /**
   * {@link SerialFacadeService#terminalText$}（terminal helper の整形済み文字列）を xterm 等へ流す。
   * プロンプト判定・コマンド結果の行処理には使わないこと。
   */
  pipeTerminalOutputToSink$(
    sink: Pick<TerminalConsoleSink, 'write'>,
  ): Observable<string> {
    return this.serial.terminalText$.pipe(tap((chunk) => sink.write(chunk)));
  }
}
