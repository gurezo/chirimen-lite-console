import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, NEVER, Subject, of, throwError } from 'rxjs';
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
import { coerceLsForSerialListing } from '@libs-terminal-util';
import { TerminalCommandRequestService } from '@libs-terminal-util';
import { TerminalViewComponent } from './terminal-view.component';

describe('TerminalViewComponent', () => {
  let fixture: ComponentFixture<TerminalViewComponent>;
  let sendMock: ReturnType<typeof vi.fn>;
  let shouldRunAfterConnectMock: ReturnType<typeof vi.fn>;
  let runAfterConnectMock: ReturnType<typeof vi.fn>;
  let terminalTextSubject: Subject<string>;
  let isConnectedSubject: BehaviorSubject<boolean>;

  beforeEach(async () => {
    sendMock = vi.fn().mockReturnValue(of(undefined));
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
          send$: (...args: unknown[]) =>
            sendMock(...(args as [string])),
          connectionEstablished$: NEVER,
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

  it('runs toolbar-requested commands via serial send$', async () => {
    const requests = TestBed.inject(TerminalCommandRequestService);
    requests.requestCommand('i2cdetect -y 1');

    await vi.waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith(
        `${coerceLsForSerialListing('i2cdetect -y 1')}\n`,
      );
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

  it('writes bootstrap failure message when post-connect setup errors', async () => {
    runAfterConnectMock.mockReturnValue(
      throwError(() => new Error('auth failed')),
    );

    fixture.destroy();
    fixture = TestBed.createComponent(TerminalViewComponent);
    const writelnSpy = vi.spyOn(fixture.componentInstance.xterminal, 'writeln');
    writelnSpy.mockClear();
    fixture.detectChanges();

    await vi.waitFor(() => {
      expect(writelnSpy).toHaveBeenCalledWith(
        '[コンソール] 接続後の初期化に失敗しました: auth failed',
      );
    });
  });

  it('shows explicit shell readiness timeout message from bootstrap flow', async () => {
    runAfterConnectMock.mockReturnValue(
      throwError(
        () => new Error('Shell readiness timeout while waiting for prompt'),
      ),
    );

    fixture.destroy();
    fixture = TestBed.createComponent(TerminalViewComponent);
    const writelnSpy = vi.spyOn(fixture.componentInstance.xterminal, 'writeln');
    writelnSpy.mockClear();
    fixture.detectChanges();

    await vi.waitFor(() => {
      expect(writelnSpy).toHaveBeenCalledWith(
        '[コンソール] 接続後の初期化に失敗しました: Shell readiness timeout while waiting for prompt',
      );
    });
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

  it('forwards terminalText$ payload to xterm without sanitizing ANSI/CR/TAB', async () => {
    const writeSpy = vi.spyOn(fixture.componentInstance.xterminal, 'write');
    writeSpy.mockClear();

    const raw = '\u001b[2K\ra\tb\r\n$ ';
    terminalTextSubject.next(raw);

    await vi.waitFor(() => expect(writeSpy).toHaveBeenCalledWith(raw));
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

});
