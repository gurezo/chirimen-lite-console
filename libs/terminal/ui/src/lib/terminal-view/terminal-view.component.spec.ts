import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, NEVER, Subject, from, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    loadAddon = vi.fn();
    open = vi.fn();
    dispose = vi.fn();
    writeln = vi.fn();
    write = vi.fn();
    reset = vi.fn();
    onKey = vi.fn();
  }
  return { Terminal: MockTerminal };
});

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit = vi.fn();
  },
}));
import {
  PiZeroSessionService,
  SerialFacadeService,
} from '@libs-web-serial-data-access';
import { PI_ZERO_PROMPT, SERIAL_TIMEOUT } from '@libs-web-serial-util';
import { TerminalCommandRequestService } from '@libs-terminal-util';
import { TerminalViewComponent } from './terminal-view.component';

describe('TerminalViewComponent', () => {
  let fixture: ComponentFixture<TerminalViewComponent>;
  let execMock: ReturnType<typeof vi.fn>;
  let shouldRunAfterConnectMock: ReturnType<typeof vi.fn>;
  let runAfterConnectMock: ReturnType<typeof vi.fn>;
  let receiveSubject: Subject<string>;
  let terminalTextSubject: Subject<string>;
  let isConnectedSubject: BehaviorSubject<boolean>;

  beforeEach(async () => {
    execMock = vi.fn().mockResolvedValue({
      stdout: `i2cdetect -y 1\n     0  1\n${PI_ZERO_PROMPT} `,
    });
    receiveSubject = new Subject<string>();
    terminalTextSubject = new Subject<string>();
    isConnectedSubject = new BehaviorSubject<boolean>(true);
    shouldRunAfterConnectMock = vi.fn(() => of(true));
    runAfterConnectMock = vi.fn(() => of(undefined));
    await TestBed.configureTestingModule({
      imports: [TerminalViewComponent],
    })
      .overrideProvider(SerialFacadeService, {
        useValue: {
          isConnected$: isConnectedSubject.asObservable(),
          exec$: (...args: unknown[]) =>
            from(execMock(...(args as [string, unknown]))),
          send$: () => of(undefined),
          connectionEstablished$: NEVER,
          receive$: receiveSubject.asObservable(),
          terminalText$: terminalTextSubject.asObservable(),
          getConnectionEpoch: () => 1,
        },
      })
      .overrideProvider(PiZeroSessionService, {
        useValue: {
          shouldRunAfterConnect$: shouldRunAfterConnectMock,
          runAfterConnect$: runAfterConnectMock,
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TerminalViewComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('runs toolbar-requested commands via serial exec', async () => {
    const requests = TestBed.inject(TerminalCommandRequestService);
    requests.requestCommand('i2cdetect -y 1');

    await vi.waitFor(() => {
      expect(execMock).toHaveBeenCalledWith('i2cdetect -y 1', {
        prompt: PI_ZERO_PROMPT,
        timeout: SERIAL_TIMEOUT.DEFAULT,
      });
    });
  });

  it('skips bootstrap execution when already initialized', async () => {
    runAfterConnectMock.mockClear();
    shouldRunAfterConnectMock.mockReturnValue(of(false));

    fixture.destroy();
    fixture = TestBed.createComponent(TerminalViewComponent);
    fixture.detectChanges();

    await vi.waitFor(() => {
      expect(shouldRunAfterConnectMock).toHaveBeenCalled();
    });
    expect(runAfterConnectMock).not.toHaveBeenCalled();
  });

  it('writes only the appended delta when terminalText$ grows by suffix', async () => {
    const writeSpy = vi.spyOn(fixture.componentInstance.xterminal, 'write');
    writeSpy.mockClear();

    terminalTextSubject.next('hello');
    terminalTextSubject.next('hello world');

    await vi.waitFor(() => {
      expect(writeSpy).toHaveBeenCalledWith('hello');
      expect(writeSpy).toHaveBeenCalledWith(' world');
    });
    expect(writeSpy).not.toHaveBeenCalledWith('hello world');
  });

  it('resets xterm and writes full text when terminalText$ prefix changes', async () => {
    const writeSpy = vi.spyOn(fixture.componentInstance.xterminal, 'write');
    const resetSpy = vi.spyOn(fixture.componentInstance.xterminal, 'reset');
    writeSpy.mockClear();
    resetSpy.mockClear();

    terminalTextSubject.next('abc');
    await vi.waitFor(() => expect(writeSpy).toHaveBeenCalledWith('abc'));

    terminalTextSubject.next('x');

    await vi.waitFor(() => {
      expect(resetSpy).toHaveBeenCalled();
      expect(writeSpy).toHaveBeenCalledWith('x');
    });
  });

  it('skips re-emission when terminalText$ value is identical to previous', async () => {
    const writeSpy = vi.spyOn(fixture.componentInstance.xterminal, 'write');
    writeSpy.mockClear();

    terminalTextSubject.next('hello');
    await vi.waitFor(() => expect(writeSpy).toHaveBeenCalledWith('hello'));

    writeSpy.mockClear();
    terminalTextSubject.next('hello');

    await Promise.resolve();
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('treats fresh terminalText$ as full write after disconnect resets cache', async () => {
    const writeSpy = vi.spyOn(fixture.componentInstance.xterminal, 'write');
    writeSpy.mockClear();

    terminalTextSubject.next('hello');
    await vi.waitFor(() => expect(writeSpy).toHaveBeenCalledWith('hello'));

    isConnectedSubject.next(false);
    await Promise.resolve();

    writeSpy.mockClear();
    isConnectedSubject.next(true);
    terminalTextSubject.next('hello');

    await vi.waitFor(() => expect(writeSpy).toHaveBeenCalledWith('hello'));
  });

  it('does not subscribe to receive$ for live mirroring', async () => {
    const writeSpy = vi.spyOn(fixture.componentInstance.xterminal, 'write');
    writeSpy.mockClear();

    receiveSubject.next('raw-chunk');

    await Promise.resolve();
    expect(writeSpy).not.toHaveBeenCalledWith('raw-chunk');
  });
});
