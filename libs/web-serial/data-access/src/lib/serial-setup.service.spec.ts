import { describe, expect, it, vi } from 'vitest';
import { of, throwError, firstValueFrom } from 'rxjs';
import { SerialSetupService } from './serial-setup.service';
import type { PiZeroSerialBootstrapService } from './pi-zero-serial-bootstrap.service';

describe('SerialSetupService', () => {
  it('returns initialized result when setup completes', async () => {
    const bootstrap = {
      runPostConnectPipeline$: vi.fn(() => of(undefined)),
      loginIfNeeded$: vi.fn(() => of(undefined)),
      setupEnvironment$: vi.fn(() => of(undefined)),
    } as unknown as PiZeroSerialBootstrapService;

    const service = new SerialSetupService(bootstrap);
    await expect(firstValueFrom(service.setupAfterConnect$())).resolves.toEqual({
      initialized: true,
    });
    expect(bootstrap.runPostConnectPipeline$).toHaveBeenCalledTimes(1);
  });

  it('propagates setup errors', async () => {
    const bootstrap = {
      runPostConnectPipeline$: vi.fn(() =>
        throwError(() => new Error('setup failed')),
      ),
      loginIfNeeded$: vi.fn(() => of(undefined)),
      setupEnvironment$: vi.fn(() => of(undefined)),
    } as unknown as PiZeroSerialBootstrapService;

    const service = new SerialSetupService(bootstrap);
    await expect(firstValueFrom(service.setupAfterConnect$())).rejects.toThrow(
      'setup failed',
    );
  });
});
