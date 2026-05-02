import { TestBed } from '@angular/core/testing';
import {
  defaultIfEmpty,
  EMPTY,
  firstValueFrom,
  forkJoin,
  of,
  Subject,
} from 'rxjs';
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
            receive$: EMPTY,
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

  it('delegates exec with default serial options', async () => {
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    await svc.runInteractiveCommand('uname', PI_ZERO_PROMPT);
    expect(execMock).toHaveBeenCalledWith('uname', {
      prompt: PI_ZERO_PROMPT,
      timeout: SERIAL_TIMEOUT.DEFAULT,
    });
  });

  it('coerces ls to dumb TERM and single-column for serial exec', async () => {
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    await svc.runInteractiveCommand('ls -la', PI_ZERO_PROMPT);
    expect(execMock).toHaveBeenCalledWith(
      "LC_ALL=C LANG=C TERM=dumb LS_COLORS= ls -1 -la </dev/null 2>&1 | sed 's/^[[:blank:]]*//' | cat",
      {
        prompt: PI_ZERO_PROMPT,
        timeout: SERIAL_TIMEOUT.DEFAULT,
      },
    );
  });

  it('runToolbarCommand reports not_connected when serial is down', async () => {
    TestBed.overrideProvider(SerialFacadeService, {
      useValue: {
        exec$: execMock,
        isConnected$: of(false),
        connectionEstablished$: of(undefined),
        receive$: EMPTY,
        terminalText$: EMPTY,
        getConnectionEpoch: () => 1,
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
    expect(writeln).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith(
      '\r\nprefix 初期化済みのためスキップします。\r\n',
    );
    expect(write).toHaveBeenCalledWith('$ ');
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

  it('pipeTerminalOutputToSink$ forwards receive$ chunks to sink.write', async () => {
    const chunks = new Subject<string>();
    TestBed.overrideProvider(SerialFacadeService, {
      useValue: {
        exec$: execMock,
        isConnected$: of(true),
        connectionEstablished$: of(undefined),
        receive$: chunks.asObservable(),
        terminalText$: EMPTY,
        getConnectionEpoch: () => 1,
      },
    });
    TestBed.overrideProvider(PiZeroSessionService, {
      useValue: {
        shouldRunAfterConnect$: () => of(true),
        runAfterConnect$: () => of(undefined),
      },
    });
    const write = vi.fn();
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    const sub = svc.pipeTerminalOutputToSink$({ write }).subscribe();
    chunks.next('a');
    chunks.next('b');
    expect(write).toHaveBeenNthCalledWith(1, 'a');
    expect(write).toHaveBeenNthCalledWith(2, 'b');
    sub.unsubscribe();
  });

  it('suppresses receive$ mirror while bootstrap is running', async () => {
    const chunks = new Subject<string>();
    const bootstrapDone$ = new Subject<void>();
    TestBed.overrideProvider(SerialFacadeService, {
      useValue: {
        exec$: execMock,
        isConnected$: of(true),
        connectionEstablished$: of(undefined),
        receive$: chunks.asObservable(),
        terminalText$: EMPTY,
        getConnectionEpoch: () => 1,
      },
    });
    TestBed.overrideProvider(PiZeroSessionService, {
      useValue: {
        shouldRunAfterConnect$: () => of(true),
        runAfterConnect$: () => bootstrapDone$.asObservable(),
      },
    });
    const write = vi.fn();
    const writeln = vi.fn();
    const svc = TestBed.inject(TerminalConsoleOrchestrationService);
    const mirrorSub = svc.pipeTerminalOutputToSink$({ write }).subscribe();
    const bootSub = svc.bootstrapAfterConnect$('prefix', { write, writeln }).subscribe();

    chunks.next('during-bootstrap');
    expect(write).not.toHaveBeenCalledWith('during-bootstrap');

    bootstrapDone$.next();
    bootstrapDone$.complete();
    chunks.next('after-bootstrap');
    expect(write).toHaveBeenCalledWith('after-bootstrap');

    bootSub.unsubscribe();
    mirrorSub.unsubscribe();
  });
});
