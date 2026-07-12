import { Injector } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { Subject } from 'rxjs';
import { PiZeroPromptDetectorService } from './pi-zero-prompt-detector.service';
import { PiZeroShellReadinessService } from './pi-zero-shell-readiness.service';
import { SerialCommandPipelineService } from './serial-command/serial-command-pipeline.service';
import { SerialTransportService } from './serial-transport.service';

describe('PiZeroShellReadinessService', () => {
  function createService(
    receive$: Subject<string>,
    readBuffer = '',
  ): PiZeroShellReadinessService {
    const transport = {
      receive$: receive$.asObservable(),
    } as SerialTransportService;
    const command = {
      inspectReadBuffer: () => readBuffer,
    } as SerialCommandPipelineService;

    const injector = Injector.create({
      providers: [
        PiZeroShellReadinessService,
        PiZeroPromptDetectorService,
        { provide: SerialTransportService, useValue: transport },
        { provide: SerialCommandPipelineService, useValue: command },
      ],
    });
    return injector.get(PiZeroShellReadinessService);
  }

  it('detects shell prompt from existing read buffer on startWatching', () => {
    const receive$ = new Subject<string>();
    const service = createService(receive$, 'boot\npi@raspberrypi:~$ ');

    service.startWatching();

    expect(service.isReady()).toBe(true);
  });

  it('detects shell prompt from subsequent receive chunks', () => {
    const receive$ = new Subject<string>();
    const service = createService(receive$);

    service.startWatching();
    expect(service.isReady()).toBe(false);

    receive$.next('pi@custom-host:~$ ');
    expect(service.isReady()).toBe(true);
  });

  it('reset clears ready and stops watching', () => {
    const receive$ = new Subject<string>();
    const service = createService(receive$, 'pi@raspberrypi:~$ ');

    service.startWatching();
    expect(service.isReady()).toBe(true);

    service.reset();
    expect(service.isReady()).toBe(false);

    receive$.next('pi@raspberrypi:~$ ');
    expect(service.isReady()).toBe(false);
  });
});
