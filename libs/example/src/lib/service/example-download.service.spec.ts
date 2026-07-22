import { TestBed } from '@angular/core/testing';
import { SerialFacadeService } from '@libs-web-serial';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExampleDownloadService } from './example-download.service';

describe('ExampleDownloadService', () => {
  let service: ExampleDownloadService;
  const exec$ = vi.fn();
  const isConnected = vi.fn();

  beforeEach(() => {
    exec$.mockReset();
    isConnected.mockReset();
    isConnected.mockReturnValue(true);
    exec$.mockReturnValue(of({ stdout: '', stderr: '', exitCode: 0 }));

    TestBed.configureTestingModule({
      providers: [
        ExampleDownloadService,
        {
          provide: SerialFacadeService,
          useValue: {
            exec$,
            isConnected,
          },
        },
      ],
    });
    service = TestBed.inject(ExampleDownloadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('throws when serial is disconnected', async () => {
    isConnected.mockReturnValue(false);
    await expect(service.downloadToShellCwd('hello-real-world')).rejects.toThrow(
      'Serial port is not connected',
    );
    expect(exec$).not.toHaveBeenCalled();
  });

  it('runs wget to shell cwd with correct url and file name', async () => {
    const fileName = await service.downloadToShellCwd('hello-real-world');

    expect(fileName).toBe('main-hello-real-world.js');
    expect(exec$).toHaveBeenCalledTimes(1);
    const [cmd, options] = exec$.mock.calls[0];
    expect(cmd).toContain('wget -O');
    expect(cmd).toContain('main-hello-real-world.js');
    expect(cmd).toContain(
      'https://tutorial.chirimen.org/pizero/esm-examples/hello-real-world/main.js',
    );
    expect(options).toMatchObject({
      prompt: 'pi@raspberrypi:',
      timeout: 60_000,
    });
  });

  it('propagates exec$ failures', async () => {
    exec$.mockReturnValue(throwError(() => new Error('timeout')));
    await expect(service.downloadToShellCwd('gpio-onchange')).rejects.toThrow(
      'timeout',
    );
  });
});
