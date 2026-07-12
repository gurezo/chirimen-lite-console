import { Injectable, signal } from '@angular/core';

/**
 * Lets other features (e.g. toolbar) ask the terminal to run a shell command
 * using the same serial path as interactive input (SerialFacadeService `send$`, issue #615).
 */
@Injectable({
  providedIn: 'root',
})
export class TerminalCommandRequestService {
  private readonly commandRequestSignal = signal<string | null>(null);
  private requestCounter = 0;

  /**
   * 直近のコマンド要求。`requestId` で同一コマンドの連続要求も検知できる。
   */
  readonly commandRequest = this.commandRequestSignal.asReadonly();
  readonly requestId = signal(0);

  requestCommand(command: string): void {
    this.requestCounter += 1;
    this.requestId.set(this.requestCounter);
    this.commandRequestSignal.set(command);
  }
}
