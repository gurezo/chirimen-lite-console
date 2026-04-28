/// <reference types="@types/w3c-web-serial" />

import { Injectable, inject } from '@angular/core';
import type { SerialError } from '@gurezo/web-serial-rxjs';
import { type Observable, take } from 'rxjs';
import {
  type CommandResult,
  SerialCommandService,
} from './serial-command.service';
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
 * Serial Facade サービス
 *
 * Transport / Validator / Command / 接続オーケストレーションを束ね、アプリ向け API を提供する薄い層。
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
  get errors$(): Observable<SerialError> {
    return this.transport.errors$;
  }
  get portInfo$(): Observable<SerialPortInfo | null> {
    return this.transport.portInfo$;
  }

  get data$() {
    return this.transport.getReadStream();
  }

  connect$(baudRate = 115200): Observable<SerialFacadeConnectResult> {
    return this.connection.connect$(baudRate);
  }

  disconnect$(): Observable<void> {
    return this.connection.disconnect$();
  }

  write$(data: string): Observable<void> {
    return this.transport.write(data);
  }

  read$(): Observable<string> {
    return this.transport.getReadStream().pipe(take(1));
  }

  exec$(
    cmd: string,
    options: SerialExecOptions,
  ): Observable<CommandResult> {
    return this.command.execWithSerialOptions$(cmd, options);
  }

  execRaw$(
    cmdRaw: string,
    options: SerialExecOptions,
  ): Observable<CommandResult> {
    return this.command.execRawWithSerialOptions$(cmdRaw, options);
  }

  readUntilPrompt$(options: SerialExecOptions): Observable<CommandResult> {
    return this.command.readUntilPromptWithSerialOptions$(options);
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
