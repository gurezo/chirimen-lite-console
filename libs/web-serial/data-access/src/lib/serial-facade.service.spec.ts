import '@angular/compiler';
import { Injector } from '@angular/core';
import { SerialSessionState } from '@gurezo/web-serial-rxjs';
import { type SerialExecOptions } from '@libs-web-serial-util';
import { EMPTY, firstValueFrom, of, take } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SerialCommandService } from './serial-command.service';
import { SerialConnectionOrchestrationService } from './serial-connection-orchestration.service';
import { SerialFacadeService } from './serial-facade.service';
import { SerialTransportService } from './serial-transport.service';
import { SerialValidatorService } from './serial-validator.service';

describe('SerialFacadeService', () => {
  let facade: SerialFacadeService;
  let transport: Partial<SerialTransportService>;
  let command: Partial<SerialCommandService>;
  let validator: Partial<SerialValidatorService>;
  let connection: Partial<SerialConnectionOrchestrationService>;

  beforeEach(async () => {
    transport = {
      state$: of(SerialSessionState.Idle),
      isConnected$: of(false),
      errors$: EMPTY,
      portInfo$: of(null),
      terminalText$: EMPTY,
      receiveReplay$: EMPTY,
      getReadStream: vi.fn(() => of('line')),
      send$: vi.fn(() => of(undefined)),
      getPort: vi.fn(() => undefined),
    };
    command = {
      execWithSerialOptions$: vi.fn(() => of({ stdout: '' })),
      execRawWithSerialOptions$: vi.fn(() => of({ stdout: '' })),
      readUntilPromptWithSerialOptions$: vi.fn(() => of({ stdout: '' })),
      isReading: vi.fn(() => false),
      getPendingCommandCount: vi.fn(() => 0),
    };
    validator = {
      isRaspberryPiZeroSerialAccess: vi.fn(() => Promise.resolve(false)),
    };
    connection = {
      connectionEstablished$: EMPTY,
      connect$: vi.fn(() => of({ ok: true } as const)),
      disconnect$: vi.fn(() => of(undefined)),
      getConnectionEpoch: vi.fn(() => 42),
    };

    const injector = Injector.create({
      providers: [
        SerialFacadeService,
        { provide: SerialTransportService, useValue: transport },
        { provide: SerialCommandService, useValue: command },
        { provide: SerialValidatorService, useValue: validator },
        {
          provide: SerialConnectionOrchestrationService,
          useValue: connection,
        },
      ],
    });
    facade = injector.get(SerialFacadeService);
  });

  it('connect$ delegates to SerialConnectionOrchestrationService.connect$', async () => {
    const result = await firstValueFrom(facade.connect$(115200));
    expect(connection.connect$).toHaveBeenCalledWith(115200);
    expect(result).toEqual({ ok: true });
  });

  it('disconnect$ delegates to SerialConnectionOrchestrationService.disconnect$', async () => {
    await firstValueFrom(facade.disconnect$());
    expect(connection.disconnect$).toHaveBeenCalled();
  });

  it('exec$ delegates to command.execWithSerialOptions$', async () => {
    const options: SerialExecOptions = {
      prompt: 'pi@raspberrypi',
      timeout: 5000,
      retry: 1,
    };
    await firstValueFrom(facade.exec$('ls', options));
    expect(command.execWithSerialOptions$).toHaveBeenCalledWith('ls', options);
  });

  it('execRaw$ delegates to command.execRawWithSerialOptions$', async () => {
    const options: SerialExecOptions = { prompt: /#$/, timeout: 3000 };
    await firstValueFrom(facade.execRaw$('id\n', options));
    expect(command.execRawWithSerialOptions$).toHaveBeenCalledWith(
      'id\n',
      options,
    );
  });

  it('readUntilPrompt$ delegates to command.readUntilPromptWithSerialOptions$', async () => {
    const options: SerialExecOptions = { prompt: 'login:', timeout: 2000 };
    await firstValueFrom(facade.readUntilPrompt$(options));
    expect(
      command.readUntilPromptWithSerialOptions$,
    ).toHaveBeenCalledWith(options);
  });

  it('send$ delegates to transport.send$', async () => {
    await firstValueFrom(facade.send$('hello'));
    expect(transport.send$).toHaveBeenCalledWith('hello');
  });

  it('write$ delegates to send$ as deprecated alias', async () => {
    await firstValueFrom(facade.write$('hello'));
    expect(transport.send$).toHaveBeenCalledWith('hello');
  });

  it('read$ takes one line from transport.getReadStream', async () => {
    const line = await firstValueFrom(facade.read$());
    expect(transport.getReadStream).toHaveBeenCalled();
    expect(line).toBe('line');
  });

  it('terminalText$ delegates to transport.terminalText$', async () => {
    transport.terminalText$ = of('chunk');
    const chunk = await firstValueFrom(facade.terminalText$.pipe(take(1)));
    expect(chunk).toBe('chunk');
  });

  it('terminalOutput$ delegates to terminalText$ as deprecated alias', async () => {
    transport.terminalText$ = of('chunk');
    const chunk = await firstValueFrom(facade.terminalOutput$.pipe(take(1)));
    expect(chunk).toBe('chunk');
  });

  it('getConnectionEpoch delegates to connection', () => {
    expect(facade.getConnectionEpoch()).toBe(42);
    expect(connection.getConnectionEpoch).toHaveBeenCalled();
  });

  it('isRaspberryPiZero delegates to validator with transport', async () => {
    await facade.isRaspberryPiZero();
    expect(validator.isRaspberryPiZeroSerialAccess).toHaveBeenCalledWith(
      transport,
    );
  });

  it('isReading and getPendingCommandCount delegate to command', () => {
    expect(facade.isReading()).toBe(false);
    expect(facade.getPendingCommandCount()).toBe(0);
    expect(command.isReading).toHaveBeenCalled();
    expect(command.getPendingCommandCount).toHaveBeenCalled();
  });
});
