import '@angular/compiler';
import { Injector } from '@angular/core';
import { SerialSessionState } from '@gurezo/web-serial-rxjs';
import { type SerialExecOptions } from '@libs-web-serial-util';
import { EMPTY, firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SerialCommandService } from './serial-command/serial-command-facade.service';
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
      isBrowserSupported: vi.fn(() => true),
      errors$: EMPTY,
      portInfo$: of(null),
      lines$: of('line'),
      receive$: EMPTY,
      terminalText$: EMPTY,
      send$: vi.fn(() => of(undefined)),
    };
    command = {
      exec$: vi.fn(() => of({ stdout: '' })),
      execRaw$: vi.fn(() => of({ stdout: '' })),
      readUntilPrompt$: vi.fn(() => of({ stdout: '' })),
    };
    validator = {
      isRaspberryPiZeroSerialAccess: vi.fn(() => Promise.resolve(false)),
    };
    connection = {
      connectionEstablished$: EMPTY,
      connect$: vi.fn(() => of({ ok: true } as const)),
      disconnect$: vi.fn(() => of(undefined)),
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

  it('exec$ delegates to command.exec$', async () => {
    const options: SerialExecOptions = {
      prompt: 'pi@raspberrypi',
      timeout: 5000,
      retry: 1,
    };
    await firstValueFrom(facade.exec$('ls', options));
    expect(command.exec$).toHaveBeenCalledWith('ls', options);
  });

  it('execRaw$ delegates to command.execRaw$', async () => {
    const options: SerialExecOptions = { prompt: /#$/, timeout: 3000 };
    await firstValueFrom(facade.execRaw$('id\n', options));
    expect(command.execRaw$).toHaveBeenCalledWith('id\n', options);
  });

  it('readUntilPrompt$ delegates to command.readUntilPrompt$', async () => {
    const options: SerialExecOptions = { prompt: 'login:', timeout: 2000 };
    await firstValueFrom(facade.readUntilPrompt$(options));
    expect(command.readUntilPrompt$).toHaveBeenCalledWith(options);
  });

  it('send$ delegates to transport.send$', async () => {
    await firstValueFrom(facade.send$('hello'));
    expect(transport.send$).toHaveBeenCalledWith('hello');
  });

  it('terminalText$ is the same stream as transport.terminalText$', () => {
    expect(facade.terminalText$).toBe(transport.terminalText$);
  });

  it('isRaspberryPiZero delegates to validator with transport', async () => {
    await facade.isRaspberryPiZero();
    expect(validator.isRaspberryPiZeroSerialAccess).toHaveBeenCalledWith(
      transport,
    );
  });

});
