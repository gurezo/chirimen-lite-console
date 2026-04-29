import { describe, expect, it, vi } from 'vitest';
import { firstValueFrom, from, of } from 'rxjs';
import { PI_ZERO_PROMPT } from '@libs-web-serial-util';
import { PiZeroSerialBootstrapService } from './pi-zero-serial-bootstrap.service';
import type { PiZeroShellReadinessService } from './pi-zero-shell-readiness.service';
import { PiZeroSessionService } from './pi-zero-session.service';
import type { SerialFacadeService } from './serial-facade.service';
import { SerialPromptDetectorService } from './serial-command/serial-prompt-detector.service';

function createShellReadinessMock(): PiZeroShellReadinessService {
  return {
    setReady: vi.fn(),
    reset: vi.fn(),
    isReady: vi.fn(() => false),
    ready$: vi.fn() as unknown as PiZeroShellReadinessService['ready$'],
  } as unknown as PiZeroShellReadinessService;
}

function createSession(
  serial: SerialFacadeService,
  shellReadiness: PiZeroShellReadinessService,
): PiZeroSessionService {
  const bootstrap = new PiZeroSerialBootstrapService(
    serial,
    new SerialPromptDetectorService(),
  );
  return new PiZeroSessionService(serial, bootstrap, shellReadiness);
}

describe('PiZeroSessionService', () => {
  it('runs at most one post-connect pipeline per connection epoch', async () => {
    const readUntilPrompt = vi.fn().mockResolvedValue({
      stdout: `${PI_ZERO_PROMPT} `,
    });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const serial = {
      isConnected$: of(true),
      getConnectionEpoch: () => 1,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
    } as unknown as SerialFacadeService;

    const shellReadiness = createShellReadinessMock();
    const service = createSession(serial, shellReadiness);
    await firstValueFrom(service.runAfterConnect$());
    await firstValueFrom(service.runAfterConnect$());

    expect(readUntilPrompt).toHaveBeenCalledTimes(1);
    expect(vi.mocked(shellReadiness.setReady)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(shellReadiness.setReady)).toHaveBeenCalledWith(true);
  });

  it('re-runs pipeline when connection epoch changes', async () => {
    let epoch = 1;
    const readUntilPrompt = vi.fn().mockResolvedValue({
      stdout: `${PI_ZERO_PROMPT} `,
    });
    const exec = vi.fn().mockResolvedValue({ stdout: '' });
    const serial = {
      isConnected$: of(true),
      getConnectionEpoch: () => epoch,
      readUntilPrompt$: (o: unknown) => from(readUntilPrompt(o)),
      exec$: (c: string, o: unknown) => from(exec(c, o)),
    } as unknown as SerialFacadeService;

    const shellReadiness = createShellReadinessMock();
    const service = createSession(serial, shellReadiness);

    await firstValueFrom(service.runAfterConnect$());
    epoch = 2;
    await firstValueFrom(service.runAfterConnect$());

    expect(readUntilPrompt).toHaveBeenCalledTimes(2);
    expect(vi.mocked(shellReadiness.setReady)).toHaveBeenCalledTimes(2);
  });
});
