import { Injectable, inject } from '@angular/core';
import {
  PiZeroSessionService,
  SerialFacadeService,
} from '@libs-web-serial';
import { coerceLsForSerialListing } from '../functions';
import {
  EMPTY,
  Observable,
  catchError,
  firstValueFrom,
  shareReplay,
  switchMap,
  throwError,
} from 'rxjs';

export interface TerminalConsoleSink {
  writeln(line: string): void;
  write(chunk: string): void;
}

/**
 * ターミナル画面向けにシリアル接続・Pi Zero bootstrap・送信を束ねる（issue #563）。
 */
@Injectable({
  providedIn: 'root',
})
export class TerminalConsoleOrchestrationService {
  private readonly serial = inject(SerialFacadeService);
  private readonly piZeroSession = inject(PiZeroSessionService);

  readonly isConnected = this.serial.isConnected;
  readonly connectionEpoch = this.serial.connectionEpoch;

  async runInteractiveCommand(command: string): Promise<string> {
    const payload = `${coerceLsForSerialListing(command)}\n`;
    await firstValueFrom(this.serial.send$(payload));
    return '';
  }

  async runToolbarCommand(cmd: string): Promise<
    | { status: 'success'; output: string }
    | { status: 'not_connected' }
    | { status: 'error'; message: string }
  > {
    if (!this.serial.isConnected()) {
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

  bootstrapAfterConnect$(
    prefixMessage: string,
    sink: TerminalConsoleSink,
  ): Observable<void> {
    return this.piZeroSession.shouldRunAfterConnect$().pipe(
      switchMap((should) => {
        if (!should) {
          return EMPTY;
        }
        return this.piZeroSession.runAfterConnect$();
      }),
      catchError((error: unknown) => {
        const message =
          error instanceof Error ? error.message : String(error);
        this.writeConsoleLine(
          sink,
          `${prefixMessage} 初期化に失敗しました: ${message}`,
        );
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  private writeConsoleLine(sink: TerminalConsoleSink, line: string): void {
    sink.writeln(line);
  }
}
