import { TestBed } from '@angular/core/testing';
import { defaultIfEmpty, firstValueFrom, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PiZeroSessionService,
  SerialFacadeService,
} from '@libs-web-serial-data-access';
import { PI_ZERO_PROMPT, SERIAL_TIMEOUT } from '@libs-web-serial-util';
import { TerminalConsoleOrchestrationService } from './terminal-console-orchestration.service';

describe('TerminalConsoleOrchestrationService', () => {
  let execMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    execMock = vi.fn().mockReturnValue(
      of({
        stdout: 'ok\n',
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        TerminalConsoleOrchestrationService,
        {
          provide: SerialFacadeService,
          useValue: {
            exec$: execMock,
            isConnected$: of(true),
            connectionEstablished$: of(undefined),
          },
        },
        {
          provide: PiZeroSessionService,
          useValue: {
            shouldRunAfterConnect$: () => of(true),
            runAfterConnect$: () => of(undefined),
          },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('delegates exec with default serial options', async () => {
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    await svc.runInteractiveCommand('uname', PI_ZERO_PROMPT);
    expect(execMock).toHaveBeenCalledWith('uname', {
      prompt: PI_ZERO_PROMPT,
      timeout: SERIAL_TIMEOUT.DEFAULT,
    });
  });

  it('runToolbarCommand reports not_connected when serial is down', async () => {
    TestBed.overrideProvider(SerialFacadeService, {
      useValue: {
        exec$: execMock,
        isConnected$: of(false),
        connectionEstablished$: of(undefined),
      },
    });
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    const result = await svc.runToolbarCommand('ls', PI_ZERO_PROMPT);
    expect(result).toEqual({ status: 'not_connected' });
    expect(execMock).not.toHaveBeenCalled();
  });

  it('bootstrapAfterConnect$ emits skip sink messages when shouldRun is false', async () => {
    const writeln = vi.fn();
    const write = vi.fn();
    TestBed.overrideProvider(PiZeroSessionService, {
      useValue: {
        shouldRunAfterConnect$: () => of(false),
        runAfterConnect$: vi.fn(),
      },
    });
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    await firstValueFrom(
      svc
        .bootstrapAfterConnect$('prefix', { writeln, write })
        .pipe(defaultIfEmpty(undefined)),
    );
    expect(writeln).toHaveBeenCalledWith(
      'prefix 初期化済みのためスキップします。',
    );
    expect(write).toHaveBeenCalledWith('$ ');
  });
});
