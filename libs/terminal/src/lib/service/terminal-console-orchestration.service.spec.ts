import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  defaultIfEmpty,
  EMPTY,
  firstValueFrom,
  of,
  throwError,
} from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PiZeroSessionService,
  PiZeroShellReadinessService,
  SerialFacadeService,
} from '@libs-web-serial';
import { coerceLsForSerialListing } from '../functions';
import { TerminalConsoleOrchestrationService } from './terminal-console-orchestration.service';

describe('TerminalConsoleOrchestrationService', () => {
  let sendMock: ReturnType<typeof vi.fn>;
  let execMock: ReturnType<typeof vi.fn>;
  let beginLogoutPending: ReturnType<typeof vi.fn>;
  let isConnectedSignal: ReturnType<typeof signal<boolean>>;

  beforeEach(() => {
    sendMock = vi.fn().mockReturnValue(of(undefined));
    execMock = vi.fn();
    beginLogoutPending = vi.fn();
    isConnectedSignal = signal(true);
    TestBed.configureTestingModule({
      providers: [
        TerminalConsoleOrchestrationService,
        {
          provide: SerialFacadeService,
          useValue: {
            send$: sendMock,
            exec$: execMock,
            isConnected: computed(() => isConnectedSignal()),
            connectionEpoch: signal(0).asReadonly(),
            terminalText: signal('').asReadonly(),
          },
        },
        {
          provide: PiZeroSessionService,
          useValue: {
            shouldRunAfterConnect$: () => of(true),
            runAfterConnect$: () => of(undefined),
          },
        },
        {
          provide: PiZeroShellReadinessService,
          useValue: { beginLogoutPending },
        },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('sendInteractiveData forwards keystrokes to send$', () => {
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    svc.sendInteractiveData('l');
    svc.sendInteractiveData('\t');
    svc.sendInteractiveData('\x1b[A');
    expect(sendMock).toHaveBeenCalledWith('l');
    expect(sendMock).toHaveBeenCalledWith('\t');
    expect(sendMock).toHaveBeenCalledWith('\x1b[A');
    expect(beginLogoutPending).not.toHaveBeenCalled();
  });

  it('notifyInteractiveCommand marks logout pending for logout', () => {
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    svc.notifyInteractiveCommand('logout');
    expect(beginLogoutPending).toHaveBeenCalledTimes(1);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('notifyInteractiveCommand marks logout pending for exit', () => {
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    svc.notifyInteractiveCommand('exit');
    expect(beginLogoutPending).toHaveBeenCalledTimes(1);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('notifyInteractiveCommand does not mark logout for other commands', () => {
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    svc.notifyInteractiveCommand('uname');
    expect(beginLogoutPending).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('runToolbarCommand reports not_connected when serial is down', async () => {
    isConnectedSignal.set(false);
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    const result = await svc.runToolbarCommand('ls');
    expect(result).toEqual({ status: 'not_connected' });
    expect(sendMock).not.toHaveBeenCalled();
    expect(execMock).not.toHaveBeenCalled();
  });

  it('runToolbarCommand sends coerced command via send$ when connected', async () => {
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    const result = await svc.runToolbarCommand('ls');
    expect(result).toEqual({ status: 'success', output: '' });
    expect(sendMock).toHaveBeenCalledWith(
      `${coerceLsForSerialListing('ls')}\n`,
    );
    expect(execMock).not.toHaveBeenCalled();
  });

  it('runToolbarCommand success always has empty output (no stdout path)', async () => {
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    const result = await svc.runToolbarCommand('echo hello');
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.output).toBe('');
    }
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
    expect(write).not.toHaveBeenCalled();
    expect(writeln).not.toHaveBeenCalled();
  });

  it('bootstrapAfterConnect$ delegates post-connect work to PiZeroSessionService', async () => {
    const writeln = vi.fn();
    const write = vi.fn();
    const runAfterConnect$ = vi.fn(() => of(undefined));
    const shouldRunAfterConnect$ = vi.fn(() => of(true));
    TestBed.overrideProvider(PiZeroSessionService, {
      useValue: {
        shouldRunAfterConnect$,
        runAfterConnect$,
      },
    });
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    await firstValueFrom(
      svc
        .bootstrapAfterConnect$('prefix', { writeln, write })
        .pipe(defaultIfEmpty(undefined)),
    );

    expect(shouldRunAfterConnect$).toHaveBeenCalledTimes(1);
    expect(runAfterConnect$).toHaveBeenCalledTimes(1);
    expect(writeln).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('bootstrapAfterConnect$ rethrows bootstrap errors for caller handling', async () => {
    const writeln = vi.fn();
    const write = vi.fn();
    TestBed.overrideProvider(PiZeroSessionService, {
      useValue: {
        shouldRunAfterConnect$: () => of(true),
        runAfterConnect$: () => throwError(() => new Error('auth failed')),
      },
    });
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);

    await expect(
      firstValueFrom(
        svc.bootstrapAfterConnect$('prefix', { writeln, write }).pipe(
          defaultIfEmpty(undefined),
        ),
      ),
    ).rejects.toThrow('auth failed');
    expect(writeln).toHaveBeenCalledWith('prefix 初期化に失敗しました: auth failed');
  });

  it('bootstrapAfterConnect$ keeps explicit shell readiness timeout errors', async () => {
    const writeln = vi.fn();
    const write = vi.fn();
    TestBed.overrideProvider(PiZeroSessionService, {
      useValue: {
        shouldRunAfterConnect$: () => of(true),
        runAfterConnect$: () =>
          throwError(
            () => new Error('Shell readiness timeout while waiting for prompt'),
          ),
      },
    });
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);

    await expect(
      firstValueFrom(
        svc.bootstrapAfterConnect$('prefix', { writeln, write }).pipe(
          defaultIfEmpty(undefined),
        ),
      ),
    ).rejects.toThrow('Shell readiness timeout while waiting for prompt');
    expect(writeln).toHaveBeenCalledWith(
      'prefix 初期化に失敗しました: Shell readiness timeout while waiting for prompt',
    );
  });

  it('bootstrapAfterConnect$ does not pass status sink into runAfterConnect$', async () => {
    const writeln = vi.fn();
    const write = vi.fn();
    const runAfterConnect$ = vi.fn(() => of(undefined));
    TestBed.overrideProvider(PiZeroSessionService, {
      useValue: {
        shouldRunAfterConnect$: () => of(true),
        runAfterConnect$,
      },
    });
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);

    await firstValueFrom(
      svc
        .bootstrapAfterConnect$('prefix', { writeln, write })
        .pipe(defaultIfEmpty(undefined)),
    );

    expect(runAfterConnect$).toHaveBeenCalledWith();
  });

});
