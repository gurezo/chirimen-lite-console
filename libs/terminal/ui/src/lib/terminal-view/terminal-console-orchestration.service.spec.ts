import { TestBed } from '@angular/core/testing';
import {
  defaultIfEmpty,
  EMPTY,
  firstValueFrom,
  forkJoin,
  of,
  throwError,
} from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PiZeroSessionService,
  SerialFacadeService,
} from '@libs-web-serial-data-access';
import { coerceLsForSerialListing } from '@libs-terminal-util';
import { TerminalConsoleOrchestrationService } from './terminal-console-orchestration.service';

describe('TerminalConsoleOrchestrationService', () => {
  let sendMock: ReturnType<typeof vi.fn>;
  let execMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendMock = vi.fn().mockReturnValue(of(undefined));
    execMock = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        TerminalConsoleOrchestrationService,
        {
          provide: SerialFacadeService,
          useValue: {
            send$: sendMock,
            exec$: execMock,
            isConnected$: of(true),
            connectionEstablished$: of(undefined),
            terminalText$: EMPTY,
            getConnectionEpoch: () => 1,
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

  it('delegates interactive input to send$ with newline', async () => {
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    await svc.runInteractiveCommand('uname');
    expect(sendMock).toHaveBeenCalledWith('uname\n');
  });

  it('runInteractiveCommand returns empty string (no stdout capture)', async () => {
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    const out = await svc.runInteractiveCommand('uname -a');
    expect(out).toBe('');
  });

  it('coerces ls to dumb TERM and single-column for serial send', async () => {
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    await svc.runInteractiveCommand('ls -la');
    expect(sendMock).toHaveBeenCalledWith(
      "LC_ALL=C LANG=C TERM=dumb LS_COLORS= ls -1 -la </dev/null 2>&1 | sed 's/^[[:blank:]]*//' | cat\n",
    );
  });

  it('runToolbarCommand reports not_connected when serial is down', async () => {
    TestBed.overrideProvider(SerialFacadeService, {
      useValue: {
        send$: sendMock,
        exec$: execMock,
        isConnected$: of(false),
        connectionEstablished$: of(undefined),
        terminalText$: EMPTY,
        getConnectionEpoch: () => 1,
      },
    });
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
    expect(writeln).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith(
      '\r\nprefix 初期化済みのためスキップします。\r\n',
    );
  });

  it('bootstrapAfterConnect$ deduplicates concurrent bootstrap calls in same epoch', async () => {
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
      forkJoin([
        svc.bootstrapAfterConnect$('prefix', { writeln, write }).pipe(
          defaultIfEmpty(undefined),
        ),
        svc.bootstrapAfterConnect$('prefix', { writeln, write }).pipe(
          defaultIfEmpty(undefined),
        ),
      ]),
    );

    expect(shouldRunAfterConnect$).toHaveBeenCalledTimes(1);
    expect(runAfterConnect$).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('\r\nprefix 初期化しています...\r\n');
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
    expect(write).toHaveBeenCalledWith('\r\nprefix 初期化しています...\r\n');
    expect(write).toHaveBeenCalledWith(
      '\r\nprefix 初期化に失敗しました: auth failed\r\n',
    );
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
    expect(write).toHaveBeenCalledWith(
      '\r\nprefix 初期化に失敗しました: Shell readiness timeout while waiting for prompt\r\n',
    );
  });

});
