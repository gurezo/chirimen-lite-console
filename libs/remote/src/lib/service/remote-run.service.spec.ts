import '@angular/compiler';
import { Injector } from '@angular/core';
import { from } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SerialFacadeService } from '@libs-web-serial';
import { PI_ZERO_PROMPT, SERIAL_TIMEOUT } from '@libs-web-serial';
import { RemoteRunService } from './remote-run.service';

describe('RemoteRunService', () => {
  let exec: ReturnType<typeof vi.fn>;
  let svc: RemoteRunService;

  beforeEach(() => {
    exec = vi.fn().mockResolvedValue({ stdout: '' });
    const injector = Injector.create({
      providers: [
        RemoteRunService,
        {
          provide: SerialFacadeService,
          useValue: {
            exec$: (...args: unknown[]) => from(exec(...args)),
          },
        },
      ],
    });
    svc = injector.get(RemoteRunService);
  });

  it('start calls forever start -w with JSON-quoted script path', async () => {
    await svc.start(`/home/pi/my app'x.js`);
    expect(exec).toHaveBeenCalledWith(
      `forever start -w ${JSON.stringify(`/home/pi/my app'x.js`)}`,
      {
        prompt: PI_ZERO_PROMPT,
        timeout: SERIAL_TIMEOUT.PROCESS_CONTROL,
      },
    );
  });

  it('start appends JSON-quoted args after the script path', async () => {
    await svc.start('/home/pi/app.js', ['--foo', `bar'baz`]);
    expect(exec).toHaveBeenCalledWith(
      `forever start -w ${JSON.stringify('/home/pi/app.js')} ${JSON.stringify('--foo')} ${JSON.stringify(`bar'baz`)}`,
      {
        prompt: PI_ZERO_PROMPT,
        timeout: SERIAL_TIMEOUT.PROCESS_CONTROL,
      },
    );
  });
});
