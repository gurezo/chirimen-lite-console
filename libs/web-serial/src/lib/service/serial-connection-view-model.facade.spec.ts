import '@angular/compiler';
import { computed, Provider, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SerialSessionStatus, type SerialSessionState } from '@gurezo/web-serial-rxjs';
import { TerminalCommandRequestService } from './terminal-command-request.service';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PiZeroSessionService } from './pi-zero-session.service';
import { PiZeroShellReadinessService } from './pi-zero-shell-readiness.service';
import { SerialFacadeService } from './serial-facade.service';
import { SerialNotificationService } from './serial-notification.service';
import { SerialConnectionViewModelFacade } from './serial-connection-view-model.facade';
import type { SerialSetupStatus } from '../models';

function createSerialMock(
  state: () => SerialSessionState,
  isConnected: () => boolean,
  overrides: Partial<SerialFacadeService> = {},
): Partial<SerialFacadeService> {
  return {
    state: computed(state),
    isConnected: computed(isConnected),
    isBrowserSupported: vi.fn(() => true),
    connect$: vi.fn(() => of({ ok: true as const })),
    disconnect$: vi.fn(() => of(undefined)),
    ...overrides,
  };
}

function createPiZeroMock(
  setupStatus: () => SerialSetupStatus,
  initializing: () => boolean,
): Partial<PiZeroSessionService> {
  return {
    setupStatus: computed(setupStatus),
    initializing: computed(initializing),
  };
}

function configureFacade(providers: Provider[]): SerialConnectionViewModelFacade {
  TestBed.configureTestingModule({
    providers: [SerialConnectionViewModelFacade, ...providers],
  });
  return TestBed.inject(SerialConnectionViewModelFacade);
}

describe('SerialConnectionViewModelFacade', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('combines state into vm', () => {
    const stateSignal = signal<SerialSessionState>({
      status: SerialSessionStatus.Idle,
    });
    const connectedSignal = signal(false);
    const setupStatusSignal = signal<SerialSetupStatus>('idle');
    const readySignal = signal(false);

    const serial = createSerialMock(
      () => stateSignal(),
      () => connectedSignal(),
    );

    const facade = configureFacade([
      { provide: SerialFacadeService, useValue: serial },
      {
        provide: PiZeroSessionService,
        useValue: createPiZeroMock(
          () => setupStatusSignal(),
          () =>
            setupStatusSignal() !== 'idle' &&
            setupStatusSignal() !== 'ready' &&
            setupStatusSignal() !== 'failed',
        ),
      },
      {
        provide: PiZeroShellReadinessService,
        useValue: { ready: readySignal.asReadonly() },
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
    ]);

    connectedSignal.set(true);
    stateSignal.set({ status: SerialSessionStatus.Connecting });

    let vm = facade.vm();
    expect(vm.isConnected).toBe(true);
    expect(vm.isConnecting).toBe(true);
    expect(vm.isInitializing).toBe(false);

    readySignal.set(true);
    stateSignal.set({
      status: SerialSessionStatus.Connected,
      portInfo: {} as SerialPortInfo,
    });

    vm = facade.vm();
    expect(vm.isConnecting).toBe(false);
    expect(vm.isLoggedIn).toBe(true);

    setupStatusSignal.set('setting-timezone');
    vm = facade.vm();
    expect(vm.isInitializing).toBe(true);
    expect(vm.setupStatus).toBe('setting-timezone');
  });

  it('connect on failure notifies and sets vm errorMessage', async () => {
    const notifyConnectionError = vi.fn();
    const serial = createSerialMock(
      () => ({ status: SerialSessionStatus.Idle }),
      () => false,
      {
        connect$: vi.fn(() =>
          of({ ok: false, errorMessage: 'port busy' } as const),
        ),
      },
    );

    const facade = configureFacade([
      { provide: SerialFacadeService, useValue: serial },
      {
        provide: PiZeroSessionService,
        useValue: createPiZeroMock(() => 'idle', () => false),
      },
      {
        provide: PiZeroShellReadinessService,
        useValue: { ready: signal(false).asReadonly() },
      },
      {
        provide: SerialNotificationService,
        useValue: {
          notifyConnectionSuccess: vi.fn(),
          notifyConnectionError,
        },
      },
      {
        provide: TerminalCommandRequestService,
        useValue: { requestCommand: vi.fn() },
      },
    ]);

    facade.connect();
    TestBed.flushEffects();

    await vi.waitFor(() => {
      expect(facade.vm().errorMessage).toBe('port busy');
    });
    expect(notifyConnectionError).toHaveBeenCalledWith('port busy');
  });

  it('clearError resets errorMessage in vm', async () => {
    const serial = createSerialMock(
      () => ({ status: SerialSessionStatus.Idle }),
      () => false,
      {
        connect$: vi.fn(() => of({ ok: false, errorMessage: 'fail' })),
      },
    );

    const facade = configureFacade([
      { provide: SerialFacadeService, useValue: serial },
      {
        provide: PiZeroSessionService,
        useValue: createPiZeroMock(() => 'idle', () => false),
      },
      {
        provide: PiZeroShellReadinessService,
        useValue: { ready: signal(false).asReadonly() },
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
    ]);

    facade.connect();
    TestBed.flushEffects();

    await vi.waitFor(() => {
      expect(facade.vm().errorMessage).toBe('fail');
    });

    facade.clearError();

    expect(facade.vm().errorMessage).toBeNull();
  });

  it('sendCommand forwards to TerminalCommandRequestService', () => {
    const requestCommand = vi.fn();
    const facade = configureFacade([
      {
        provide: SerialFacadeService,
        useValue: createSerialMock(
          () => ({ status: SerialSessionStatus.Idle }),
          () => false,
        ),
      },
      {
        provide: PiZeroSessionService,
        useValue: createPiZeroMock(() => 'idle', () => false),
      },
      {
        provide: PiZeroShellReadinessService,
        useValue: { ready: signal(false).asReadonly() },
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
    ]);

    facade.sendCommand('ls');

    expect(requestCommand).toHaveBeenCalledWith('ls');
  });
});
