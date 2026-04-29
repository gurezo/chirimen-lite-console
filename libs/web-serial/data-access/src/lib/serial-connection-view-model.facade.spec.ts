import '@angular/compiler';
import { Injector } from '@angular/core';
import { SerialSessionState } from '@gurezo/web-serial-rxjs';
import { TerminalCommandRequestService } from '@libs-terminal-util';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PiZeroSessionService } from './pi-zero-session.service';
import { PiZeroShellReadinessService } from './pi-zero-shell-readiness.service';
import { SerialFacadeService } from './serial-facade.service';
import { SerialNotificationService } from './serial-notification.service';
import { SerialConnectionViewModelFacade } from './serial-connection-view-model.facade';

describe('SerialConnectionViewModelFacade', () => {
  it('combines state into vm$', async () => {
    const state$ = new BehaviorSubject(SerialSessionState.Idle);
    const connected$ = new BehaviorSubject(false);
    const initializing$ = new BehaviorSubject(false);
    const ready$ = new BehaviorSubject(false);

    const serial: Partial<SerialFacadeService> = {
      state$: state$.asObservable(),
      isConnected$: connected$.asObservable(),
      connect$: vi.fn(() => of({ ok: true })),
      disconnect$: vi.fn(() => of(undefined)),
    };

    const injector = Injector.create({
      providers: [
        SerialConnectionViewModelFacade,
        { provide: SerialFacadeService, useValue: serial },
        {
          provide: PiZeroSessionService,
          useValue: { initializing$: initializing$.asObservable() },
        },
        {
          provide: PiZeroShellReadinessService,
          useValue: { ready$: ready$.asObservable() },
        },
        {
          provide: SerialNotificationService,
          useValue: {
            notifyConnectionSuccess: vi.fn(),
            notifyConnectionError: vi.fn(),
          },
        },
        {
          provide: TerminalCommandRequestService,
          useValue: { requestCommand: vi.fn() },
        },
      ],
    });

    const facade = injector.get(SerialConnectionViewModelFacade);

    connected$.next(true);
    state$.next(SerialSessionState.Connecting);

    let vm = await firstValueFrom(facade.vm$);
    expect(vm.isConnected).toBe(true);
    expect(vm.isConnecting).toBe(true);
    expect(vm.isInitializing).toBe(false);

    ready$.next(true);
    state$.next(SerialSessionState.Connected);

    vm = await firstValueFrom(facade.vm$);
    expect(vm.isConnecting).toBe(false);
    expect(vm.isLoggedIn).toBe(true);

    initializing$.next(true);
    vm = await firstValueFrom(facade.vm$);
    expect(vm.isInitializing).toBe(true);
  });

  it('clearError resets errorMessage in vm$', async () => {
    const serial: Partial<SerialFacadeService> = {
      state$: of(SerialSessionState.Idle),
      isConnected$: of(false),
      connect$: vi.fn(() => of({ ok: false, errorMessage: 'fail' })),
      disconnect$: vi.fn(() => of(undefined)),
    };

    const injector = Injector.create({
      providers: [
        SerialConnectionViewModelFacade,
        { provide: SerialFacadeService, useValue: serial },
        {
          provide: PiZeroSessionService,
          useValue: { initializing$: of(false) },
        },
        {
          provide: PiZeroShellReadinessService,
          useValue: { ready$: of(false) },
        },
        {
          provide: SerialNotificationService,
          useValue: {
            notifyConnectionSuccess: vi.fn(),
            notifyConnectionError: vi.fn(),
          },
        },
        {
          provide: TerminalCommandRequestService,
          useValue: { requestCommand: vi.fn() },
        },
      ],
    });

    const facade = injector.get(SerialConnectionViewModelFacade);

    facade.connect();

    const afterFail = await firstValueFrom(facade.vm$);
    expect(afterFail.errorMessage).toBe('fail');

    facade.clearError();

    const cleared = await firstValueFrom(facade.vm$);
    expect(cleared.errorMessage).toBeNull();
  });

  it('sendCommand forwards to TerminalCommandRequestService', () => {
    const requestCommand = vi.fn();
    const injector = Injector.create({
      providers: [
        SerialConnectionViewModelFacade,
        {
          provide: SerialFacadeService,
          useValue: {
            state$: of(SerialSessionState.Idle),
            isConnected$: of(false),
            connect$: vi.fn(),
            disconnect$: vi.fn(),
          },
        },
        {
          provide: PiZeroSessionService,
          useValue: { initializing$: of(false) },
        },
        {
          provide: PiZeroShellReadinessService,
          useValue: { ready$: of(false) },
        },
        {
          provide: SerialNotificationService,
          useValue: {
            notifyConnectionSuccess: vi.fn(),
            notifyConnectionError: vi.fn(),
          },
        },
        {
          provide: TerminalCommandRequestService,
          useValue: { requestCommand },
        },
      ],
    });

    const facade = injector.get(SerialConnectionViewModelFacade);
    facade.sendCommand('ls');

    expect(requestCommand).toHaveBeenCalledWith('ls');
  });
});
