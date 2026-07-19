import { computed, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { NotificationService } from '@libs-shared';
import { SerialExpectedDisconnectService } from '@libs-web-serial';
import { SerialFacadeService } from '@libs-web-serial';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WifiPostConnectRebootFlowService } from './wifi-post-connect-reboot-flow.service';
import { WifiRebootFlowService } from './wifi-reboot-flow.service';

describe('WifiPostConnectRebootFlowService', () => {
  let service: WifiPostConnectRebootFlowService;
  let rebootDevice: ReturnType<typeof vi.fn>;
  let disconnect$: ReturnType<typeof vi.fn>;
  let notifyError: ReturnType<typeof vi.fn>;
  let notifyInfo: ReturnType<typeof vi.fn>;
  let notifyWarning: ReturnType<typeof vi.fn>;
  let expectedDisconnect: SerialExpectedDisconnectService;
  let isConnectedSignal: ReturnType<typeof signal<boolean>>;
  let openSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rebootDevice = vi.fn().mockResolvedValue('ok');
    disconnect$ = vi.fn().mockReturnValue(of(undefined));
    notifyError = vi.fn();
    notifyInfo = vi.fn();
    notifyWarning = vi.fn();
    isConnectedSignal = signal(true);
    expectedDisconnect = new SerialExpectedDisconnectService();

    openSpy = vi.fn().mockImplementation(() => ({
      closed: of(true),
    }));

    TestBed.configureTestingModule({
      providers: [
        WifiPostConnectRebootFlowService,
        {
          provide: Dialog,
          useValue: { open: openSpy },
        },
        {
          provide: NotificationService,
          useValue: {
            error: notifyError,
            info: notifyInfo,
            warning: notifyWarning,
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
          provide: WifiRebootFlowService,
          useValue: { rebootDevice },
        },
        {
          provide: SerialExpectedDisconnectService,
          useValue: expectedDisconnect,
        },
      ],
    });

    service = TestBed.inject(WifiPostConnectRebootFlowService);
  });

  it('does nothing when user cancels reboot confirmation', async () => {
    openSpy.mockImplementationOnce(() => ({
      closed: of(false),
    }));

    await service.run();

    expect(rebootDevice).not.toHaveBeenCalled();
    expect(expectedDisconnect.isExpectedDisconnect()).toBe(false);
    expect(expectedDisconnect.rebootPending()).toBe(false);
    expect(service.inProgress()).toBe(false);
  });

  it('shows error and clears expected disconnect when reboot fails while connected', async () => {
    rebootDevice.mockResolvedValueOnce('failed');
    isConnectedSignal.set(true);

    await service.run();

    expect(rebootDevice).toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledWith(
      'WiFi',
      expect.stringContaining('再起動コマンド'),
    );
    expect(expectedDisconnect.isExpectedDisconnect()).toBe(false);
    expect(expectedDisconnect.rebootPending()).toBe(false);
    expect(disconnect$).not.toHaveBeenCalled();
  });

  it('raises rebootPending during reboot cleanup and clears before guidance dialogs', async () => {
    isConnectedSignal.set(true);
    rebootDevice.mockImplementationOnce(async () => {
      expect(expectedDisconnect.rebootPending()).toBe(true);
      isConnectedSignal.set(false);
      return 'ok' as const;
    });
    disconnect$.mockImplementationOnce(() => {
      expect(expectedDisconnect.rebootPending()).toBe(true);
      return of(undefined);
    });

    let sawPendingDuringGuidance = false;
    let dialogCount = 0;
    openSpy.mockImplementation(() => {
      dialogCount += 1;
      if (dialogCount >= 2) {
        // confirm の後 = 案内ダイアログ。この時点では UI pending は解除済み。
        sawPendingDuringGuidance = expectedDisconnect.rebootPending();
        queueMicrotask(() => {
          isConnectedSignal.set(true);
        });
      }
      return { closed: of(true) };
    });

    await service.run();

    expect(sawPendingDuringGuidance).toBe(false);
    expect(expectedDisconnect.rebootPending()).toBe(false);
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

    confirmClosed.next(false);
    confirmClosed.complete();
    await first;
    expect(service.inProgress()).toBe(false);
  });

  it('cleans up serial and shows reconnect guidance after successful reboot', async () => {
    const afterReconnect = vi.fn().mockResolvedValue(undefined);
    isConnectedSignal.set(true);

    // confirm → reboot → disconnect → info ×2 → wait (already connected after cleanup?)
    // After rebootDevice returns ok, isConnected should be false then disconnect$ runs.
    rebootDevice.mockImplementationOnce(async () => {
      isConnectedSignal.set(false);
      return 'ok' as const;
    });

    // After guidance dialogs, simulate user reconnect
    let dialogCount = 0;
    openSpy.mockImplementation(() => {
      dialogCount += 1;
      if (dialogCount === 3) {
        // third dialog (reconnect guidance) closed → then waitForReconnect
        queueMicrotask(() => {
          isConnectedSignal.set(true);
        });
      }
      return { closed: of(true) };
    });

    await service.run({ afterReconnect });

    expect(disconnect$).toHaveBeenCalled();
    expect(notifyInfo).toHaveBeenCalledWith('WiFi', '再起動を送信しました');
    expect(afterReconnect).toHaveBeenCalled();
    expect(expectedDisconnect.isExpectedDisconnect()).toBe(false);
    expect(expectedDisconnect.rebootPending()).toBe(false);
    expect(dialogCount).toBeGreaterThanOrEqual(3);
  });
});
