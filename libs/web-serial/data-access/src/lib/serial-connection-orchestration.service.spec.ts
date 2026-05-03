import '@angular/compiler';
import { Injector } from '@angular/core';
import { BehaviorSubject, firstValueFrom, of, take } from 'rxjs';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { PiZeroShellReadinessService } from './pi-zero-shell-readiness.service';
import { SerialCommandService } from './serial-command/serial-command-facade.service';
import { SerialConnectionOrchestrationService } from './serial-connection-orchestration.service';
import { SerialTransportService } from './serial-transport.service';

describe('SerialConnectionOrchestrationService', () => {
  let service: SerialConnectionOrchestrationService;
  let isConnectedSubj: BehaviorSubject<boolean>;
  let transport: Partial<SerialTransportService>;
  let connectMock: Mock;
  let disconnectMock: Mock;
  let command: Partial<SerialCommandService>;
  let shellReadiness: PiZeroShellReadinessService;

  beforeEach(() => {
    isConnectedSubj = new BehaviorSubject(false);
    command = {
      startReadLoop: vi.fn(),
      stopReadLoop: vi.fn(),
      cancelAllCommands: vi.fn(),
    };
    connectMock = vi.fn(() => of({ port: {} as SerialPort }));
    disconnectMock = vi.fn(() => of(undefined));
    transport = {
      isConnected$: isConnectedSubj.asObservable(),
      connect$: connectMock,
      disconnect$: disconnectMock,
    };
    shellReadiness = new PiZeroShellReadinessService();

    const injector = Injector.create({
      providers: [
        SerialConnectionOrchestrationService,
        { provide: SerialTransportService, useValue: transport },
        { provide: SerialCommandService, useValue: command },
        { provide: PiZeroShellReadinessService, useValue: shellReadiness },
      ],
    });
    service = injector.get(SerialConnectionOrchestrationService);
  });

  it('getConnectionEpoch starts at 0', () => {
    expect(service.getConnectionEpoch()).toBe(0);
  });

  it('on successful connect increments epoch, starts read loop, resets shell readiness, emits connectionEstablished$', async () => {
    const establishedOnce = firstValueFrom(
      service.connectionEstablished$.pipe(take(1)),
    );

    shellReadiness.setReady(true);
    const result = await firstValueFrom(service.connect$(115200));
    await establishedOnce;

    expect(result).toEqual({ ok: true });
    expect(service.getConnectionEpoch()).toBe(1);
    expect(command.startReadLoop).toHaveBeenCalledTimes(1);
    expect(shellReadiness.isReady()).toBe(false);
    expect(connectMock).toHaveBeenCalledWith(115200);
  });

  it('when already connected, orchestration disconnect runs before transport connect', async () => {
    isConnectedSubj.next(true);

    await firstValueFrom(service.connect$(9600));

    expect(disconnectMock).toHaveBeenCalled();
    expect(connectMock).toHaveBeenCalledWith(9600);
    expect(service.getConnectionEpoch()).toBe(1);
    const disconnectOrder = disconnectMock.mock.invocationCallOrder[0];
    const connectOrder = connectMock.mock.invocationCallOrder[0];
    expect(disconnectOrder).toBeLessThan(connectOrder);
  });

  it('each successful connect after disconnect increments connectionEpoch', async () => {
    await firstValueFrom(service.connect$(115200));
    expect(service.getConnectionEpoch()).toBe(1);

    await firstValueFrom(service.disconnect$());
    await firstValueFrom(service.connect$(115200));

    expect(service.getConnectionEpoch()).toBe(2);
  });

  it('disconnect$ resets shell readiness, cancels commands, stops read loop, disconnects transport', async () => {
    await firstValueFrom(service.connect$(115200));
    shellReadiness.setReady(true);

    await firstValueFrom(service.disconnect$());

    expect(command.cancelAllCommands).toHaveBeenCalled();
    expect(command.stopReadLoop).toHaveBeenCalled();
    expect(disconnectMock).toHaveBeenCalled();
    expect(shellReadiness.isReady()).toBe(false);
  });

  it('does not increment epoch or start read loop when transport returns error', async () => {
    connectMock.mockReturnValue(of({ error: 'permission denied' }));

    let establishedFired = false;
    const sub = service.connectionEstablished$.subscribe(() => {
      establishedFired = true;
    });
    const result = await firstValueFrom(service.connect$(115200));
    sub.unsubscribe();

    expect(result).toEqual({
      ok: false,
      errorMessage: 'permission denied',
    });
    expect(service.getConnectionEpoch()).toBe(0);
    expect(command.startReadLoop).not.toHaveBeenCalled();
    expect(establishedFired).toBe(false);
  });
});
