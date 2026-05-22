import '@angular/compiler';
import { Injector } from '@angular/core';
import { from } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SerialFacadeService } from '@libs-web-serial';
import { PI_ZERO_PROMPT, SERIAL_TIMEOUT } from '@libs-web-serial';
import { RemoteStopService } from './remote-stop.service';

describe('RemoteStopService', () => {
  let exec: ReturnType<typeof vi.fn>;
  let svc: RemoteStopService;

  beforeEach(() => {
    exec = vi.fn().mockResolvedValue({ stdout: '' });
    const injector = Injector.create({
      providers: [
        RemoteStopService,
        {
          provide: SerialFacadeService,
          useValue: {
            exec$: (...args: unknown[]) => from(exec(...args)),
          },
        },
      ],
    });
    svc = injector.get(RemoteStopService);
  });

  it('stopAll calls forever stopall', async () => {
    await svc.stopAll();
    expect(exec).toHaveBeenCalledWith('forever stopall', {
      prompt: PI_ZERO_PROMPT,
      timeout: SERIAL_TIMEOUT.PROCESS_CONTROL,
    });
  });

  it('stopTarget calls forever stop with JSON-quoted target', async () => {
    await svc.stopTarget(`app'x`);
    expect(exec).toHaveBeenCalledWith(`forever stop ${JSON.stringify(`app'x`)}`, {
      prompt: PI_ZERO_PROMPT,
      timeout: SERIAL_TIMEOUT.PROCESS_CONTROL,
    });
  });
});
