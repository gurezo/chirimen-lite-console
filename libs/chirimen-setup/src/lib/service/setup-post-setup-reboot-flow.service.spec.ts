import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '@libs-dialogs';
import { NotificationService } from '@libs-shared';
import {
  SerialExpectedDisconnectService,
  SerialFacadeService,
} from '@libs-web-serial';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SetupPostSetupRebootFlowService } from './setup-post-setup-reboot-flow.service';
import { SetupRebootFlowService } from './setup-reboot-flow.service';

describe('SetupPostSetupRebootFlowService', () => {
  let service: SetupPostSetupRebootFlowService;
  let rebootDevice: ReturnType<typeof vi.fn>;
  let disconnect$: ReturnType<typeof vi.fn>;
  let closeSpy: ReturnType<typeof vi.fn>;
  let openSpy: ReturnType<typeof vi.fn>;
  let notifyInfo: ReturnType<typeof vi.fn>;
  let expectedDisconnect: SerialExpectedDisconnectService;
  let isConnectedSignal: ReturnType<typeof signal<boolean>>;

  beforeEach(() => {
    rebootDevice = vi.fn().mockResolvedValue('ok');
    disconnect$ = vi.fn().mockReturnValue(of(undefined));
    closeSpy = vi.fn();
    notifyInfo = vi.fn();
    isConnectedSignal = signal(true);
    expectedDisconnect = new SerialExpectedDisconnectService();

    openSpy = vi.fn().mockImplementation(() => ({
      closed: of(true),
    }));

    TestBed.configureTestingModule({
      providers: [
        SetupPostSetupRebootFlowService,
        {
          provide: DialogService,
          useValue: { open: openSpy, close: closeSpy },
        },
        {
          provide: NotificationService,
          useValue: {
            error: vi.fn(),
            info: notifyInfo,
            warning: vi.fn(),
            success: vi.fn(),
          },
        },
        {
          provide: SerialFacadeService,
          useValue: {
            isConnected: computed(() => isConnectedSignal()),
            disconnect$,
          },
        },
        {
          provide: SetupRebootFlowService,
          useValue: { rebootDevice },
        },
        {
          provide: SerialExpectedDisconnectService,
          useValue: expectedDisconnect,
        },
      ],
    });

    service = TestBed.inject(SetupPostSetupRebootFlowService);
  });

  it('closes setup dialog when user confirms reboot', async () => {
    isConnectedSignal.set(true);
    rebootDevice.mockImplementationOnce(async () => {
      isConnectedSignal.set(false);
      return 'ok' as const;
    });

    let dialogCount = 0;
    openSpy.mockImplementation(() => {
      dialogCount += 1;
      if (dialogCount === 3) {
        queueMicrotask(() => {
          isConnectedSignal.set(true);
        });
      }
      return { closed: of(true) };
    });

    await service.run();

    expect(closeSpy).toHaveBeenCalled();
    expect(rebootDevice).toHaveBeenCalled();
  });

  it('does not close setup dialog when user cancels reboot confirmation', async () => {
    openSpy.mockImplementationOnce(() => ({
      closed: of(false),
    }));

    await service.run();

    expect(closeSpy).not.toHaveBeenCalled();
    expect(rebootDevice).not.toHaveBeenCalled();
    expect(expectedDisconnect.isExpectedDisconnect()).toBe(false);
    expect(expectedDisconnect.rebootPending()).toBe(false);
    expect(service.inProgress()).toBe(false);
    expect(notifyInfo).toHaveBeenCalledWith(
      'Setup',
      expect.stringContaining('再起動をスキップ'),
    );
  });

  it('prevents double execution while a flow is in progress', async () => {
    const confirmClosed = new Subject<boolean>();
    openSpy.mockImplementationOnce(() => ({
      closed: confirmClosed.asObservable(),
    }));

    const first = service.run();
    await vi.waitFor(() => {
      expect(service.inProgress()).toBe(true);
    });

    await service.run();
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(rebootDevice).not.toHaveBeenCalled();
    expect(closeSpy).not.toHaveBeenCalled();

    confirmClosed.next(false);
    confirmClosed.complete();
    await first;
    expect(service.inProgress()).toBe(false);
  });
});
