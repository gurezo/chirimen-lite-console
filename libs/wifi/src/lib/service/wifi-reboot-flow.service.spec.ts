import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SerialFacadeService } from '@libs-web-serial';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WifiRebootFlowService } from './wifi-reboot-flow.service';

describe('WifiRebootFlowService', () => {
  let service: WifiRebootFlowService;
  let exec$: ReturnType<typeof vi.fn>;
  let isConnectedSignal: ReturnType<typeof signal<boolean>>;

  beforeEach(() => {
    isConnectedSignal = signal(true);
    exec$ = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        WifiRebootFlowService,
        {
          provide: SerialFacadeService,
          useValue: {
            isConnected: computed(() => isConnectedSignal()),
            exec$,
          },
        },
      ],
    });

    service = TestBed.inject(WifiRebootFlowService);
  });

  it('rebootDevice returns ok when serial disconnects after reboot', async () => {
    exec$.mockReturnValue(
      throwError(() => new Error('timeout')),
    );
    isConnectedSignal.set(false);

    await expect(service.rebootDevice()).resolves.toBe('ok');
  });

  it('rebootDevice returns failed when serial stays connected', async () => {
    exec$.mockReturnValue(of({ stdout: 'sudo: reboot: command not found' }));
    isConnectedSignal.set(true);

    await expect(service.rebootDevice()).resolves.toBe('failed');
  });
});
