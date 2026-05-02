/// <reference types="@types/w3c-web-serial" />

/** Full rewrite (#606). Facade over `SerialSession` v2.3.1 via {@link SerialTransportService}. */
import { Injectable, inject } from '@angular/core';
import { type Observable, take } from 'rxjs';
import {
  type CommandResult,
  SerialCommandService,
} from './serial-command/serial-command-facade.service';
import {
  type SerialConnectResult,
  SerialConnectionOrchestrationService,
} from './serial-connection-orchestration.service';
import {
  type SerialExecOptions,
} from '@libs-web-serial-util';
import { SerialTransportService } from './serial-transport.service';
import { SerialValidatorService } from './serial-validator.service';

/** {@link SerialFacadeService#connect$} の結果（後方互換の別名） */
export type SerialFacadeConnectResult = SerialConnectResult;

/**
 * アプリ唯一の入口。`@gurezo/web-serial-rxjs` v2.3.1 の {@link SerialSession} 由来は
 * {@link SerialTransportService} が `isBrowserSupported` / `connect$` / `disconnect$` /
 * `isConnected$` / `terminalText$` / `lines$` / `errors$` で橋渡しする。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialFacadeService {
  private transport = inject(SerialTransportService);
  private command = inject(SerialCommandService);
  private validator = inject(SerialValidatorService);
  private connection = inject(SerialConnectionOrchestrationService);

  readonly connectionEstablished$ = this.connection.connectionEstablished$;

  readonly state$ = this.transport.state$;
  readonly isConnected$ = this.transport.isConnected$;

  /** {@link SerialTransportService.isBrowserSupported} */
  isBrowserSupported(): boolean {
    return this.transport.isBrowserSupported();
  }

  readonly errors$ = this.transport.errors$;
  readonly portInfo$ = this.transport.portInfo$;
  readonly lines$ = this.transport.lines$;
  readonly terminalText$ = this.transport.terminalText$;

  connect$(baudRate = 115200): Observable<SerialFacadeConnectResult> {
    return this.connection.connect$(baudRate);
  }

  disconnect$(): Observable<void> {
    return this.connection.disconnect$();
  }

  send$(data: string): Observable<void> {
    return this.transport.send$(data);
  }

  read$(): Observable<string> {
    return this.lines$.pipe(take(1));
  }

  exec$(
    cmd: string,
    options: SerialExecOptions,
  ): Observable<CommandResult> {
    return this.command.exec$(cmd, options);
  }

  execRaw$(
    cmdRaw: string,
    options: SerialExecOptions,
  ): Observable<CommandResult> {
    return this.command.execRaw$(cmdRaw, options);
  }

  readUntilPrompt$(options: SerialExecOptions): Observable<CommandResult> {
    return this.command.readUntilPrompt$(options);
  }

  getConnectionEpoch(): number {
    return this.connection.getConnectionEpoch();
  }

  isReading(): boolean {
    return this.command.isReading();
  }

  getPendingCommandCount(): number {
    return this.command.getPendingCommandCount();
  }

  isRaspberryPiZero(): Promise<boolean> {
    return this.validator.isRaspberryPiZeroSerialAccess(this.transport);
  }

  getPort(): SerialPort | null {
    return this.transport.getPort() ?? null;
  }
}
