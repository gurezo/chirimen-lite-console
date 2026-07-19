import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { NEVER, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    loadAddon = vi.fn();
    open = vi.fn();
    dispose = vi.fn();
    writeln = vi.fn();
    write = vi.fn();
    clear = vi.fn();
    reset = vi.fn();
    keyHandler?: (event: {
      domEvent: {
        altKey: boolean;
        ctrlKey: boolean;
        metaKey: boolean;
        code: string;
        key: string;
      };
    }) => void;
    onKey = vi.fn(
      (
        handler: (event: {
          domEvent: {
            altKey: boolean;
            ctrlKey: boolean;
            metaKey: boolean;
            code: string;
            key: string;
          };
        }) => void,
      ) => {
        this.keyHandler = handler;
      },
    );
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
  PiZeroShellReadinessService,
  SerialConnectionViewModelFacade,
  SerialExpectedDisconnectService,
  SerialFacadeService,
  TerminalCommandRequestService,
  type SerialConnectionViewModel,
} from '@libs-web-serial';
import { coerceLsForSerialListing } from '../../functions';
import { TerminalViewComponent } from './terminal-view.component';

describe('TerminalViewComponent', () => {
  let fixture: ComponentFixture<TerminalViewComponent>;
  let sendMock: ReturnType<typeof vi.fn>;
  let shouldRunAfterConnectMock: ReturnType<typeof vi.fn>;
  let runAfterConnectMock: ReturnType<typeof vi.fn>;
  let terminalTextSignal: ReturnType<typeof signal<string>>;
  let isConnectedSignal: ReturnType<typeof signal<boolean>>;
  let connectionEpochSignal: ReturnType<typeof signal<number>>;
  let logoutPendingSignal: ReturnType<typeof signal<boolean>>;
  let rebootPendingSignal: ReturnType<typeof signal<boolean>>;
  let connectionVmSignal: ReturnType<typeof signal<SerialConnectionViewModel>>;

  function vmDefaults(
    overrides: Partial<SerialConnectionViewModel> = {},
  ): SerialConnectionViewModel {
    return {
      isBrowserSupported: true,
      isConnected: true,
      isConnecting: false,
      isLoggedIn: true,
      isInitializing: false,
      setupStatus: 'ready',
      errorMessage: null,
      ...overrides,
    };
  }

  function expectSentKeystrokes(...chunks: string[]): void {
    expect(sendMock.mock.calls.map((call) => call[0])).toEqual(chunks);
  }

  function typeCommand(command: string): void {
    const terminal = fixture.componentInstance.xterminal as unknown as {
      keyHandler?: (event: {
        domEvent: {
          altKey: boolean;
          ctrlKey: boolean;
          metaKey: boolean;
          code: string;
          key: string;
          preventDefault?: () => void;
        };
      }) => void;
    };

    for (const key of command) {
      terminal.keyHandler?.({
        domEvent: {
          altKey: false,
          ctrlKey: false,
          metaKey: false,
          code: key === ' ' ? 'Space' : 'Key',
          key,
          preventDefault: vi.fn(),
        },
      });
    }
    terminal.keyHandler?.({
      domEvent: {
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        code: 'Enter',
        key: 'Enter',
        preventDefault: vi.fn(),
      },
    });
  }

  beforeEach(async () => {
    sendMock = vi.fn().mockReturnValue(of(undefined));
    terminalTextSignal = signal('');
    isConnectedSignal = signal(true);
    connectionEpochSignal = signal(1);
    logoutPendingSignal = signal(false);
    rebootPendingSignal = signal(false);
    connectionVmSignal = signal(vmDefaults());
    shouldRunAfterConnectMock = vi.fn(() => of(true));
    runAfterConnectMock = vi.fn(() => of(undefined));
    await TestBed.configureTestingModule({
      imports: [TerminalViewComponent],
    })
      .overrideProvider(SerialFacadeService, {
        useValue: {
          isConnected: computed(() => isConnectedSignal()),
          send$: (...args: unknown[]) =>
            sendMock(...(args as [string])),
          connectionEpoch: connectionEpochSignal.asReadonly(),
          terminalText: terminalTextSignal.asReadonly(),
        },
      })
      .overrideProvider(PiZeroSessionService, {
        useValue: {
          shouldRunAfterConnect$: shouldRunAfterConnectMock,
          runAfterConnect$: runAfterConnectMock,
        },
      })
      .overrideProvider(PiZeroShellReadinessService, {
        useValue: {
          logoutPending: logoutPendingSignal.asReadonly(),
          beginLogoutPending: vi.fn(() => logoutPendingSignal.set(true)),
          clearLogoutPending: vi.fn(() => logoutPendingSignal.set(false)),
        },
      })
      .overrideProvider(SerialExpectedDisconnectService, {
        useValue: {
          rebootPending: rebootPendingSignal.asReadonly(),
          beginRebootPending: vi.fn(() => rebootPendingSignal.set(true)),
          clearRebootPending: vi.fn(() => rebootPendingSignal.set(false)),
        },
      })
      .overrideProvider(SerialConnectionViewModelFacade, {
        useValue: {
          vm: computed(() => connectionVmSignal()),
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

  it('clears the display for a trimmed clear command and keeps accepting input', async () => {
    const clearSpy = vi.spyOn(fixture.componentInstance.xterminal, 'clear');

    typeCommand(' clear ');

    await vi.waitFor(() => {
      expect(clearSpy).toHaveBeenCalledTimes(1);
      expectSentKeystrokes(' ', 'c', 'l', 'e', 'a', 'r', ' ', '\r');
    });

    sendMock.mockClear();
    typeCommand('pwd');

    await vi.waitFor(() => {
      expectSentKeystrokes('p', 'w', 'd', '\r');
    });
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores typed input while connected but shell is not ready', async () => {
    connectionVmSignal.set(
      vmDefaults({
        isConnected: true,
        isLoggedIn: false,
        setupStatus: 'waiting-login',
      }),
    );
    TestBed.flushEffects();
    sendMock.mockClear();

    typeCommand('pwd');

    await Promise.resolve();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('ignores typed input while rebootPending is true', async () => {
    rebootPendingSignal.set(true);
    TestBed.flushEffects();
    sendMock.mockClear();

    typeCommand('pwd');

    await Promise.resolve();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('accepts typed input again after setup fails', async () => {
    connectionVmSignal.set(
      vmDefaults({
        isConnected: true,
        isLoggedIn: false,
        setupStatus: 'failed',
      }),
    );
    TestBed.flushEffects();
    sendMock.mockClear();

    typeCommand('pwd');

    await vi.waitFor(() => {
      expectSentKeystrokes('p', 'w', 'd', '\r');
    });
  });

  it('does not clear the display for commands containing clear', async () => {
    const clearSpy = vi.spyOn(fixture.componentInstance.xterminal, 'clear');

    typeCommand('clear logs');

    await vi.waitFor(() => {
      expectSentKeystrokes(
        'c',
        'l',
        'e',
        'a',
        'r',
        ' ',
        'l',
        'o',
        'g',
        's',
        '\r',
      );
    });
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('writes only new serial output after clearing the display', async () => {
    const writeSpy = vi.spyOn(fixture.componentInstance.xterminal, 'write');
    terminalTextSignal.set('previous output');
    TestBed.flushEffects();
    await vi.waitFor(() =>
      expect(writeSpy).toHaveBeenCalledWith('previous output'),
    );

    typeCommand('clear');
    await vi.waitFor(() =>
      expectSentKeystrokes('c', 'l', 'e', 'a', 'r', '\r'),
    );
    writeSpy.mockClear();

    terminalTextSignal.set('previous outputnext output');
    TestBed.flushEffects();

    await vi.waitFor(() =>
      expect(writeSpy).toHaveBeenCalledWith('next output'),
    );
    expect(writeSpy).not.toHaveBeenCalledWith('previous outputnext output');
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

  it('writes only the appended delta when terminalText grows by suffix', async () => {
    const writeSpy = vi.spyOn(fixture.componentInstance.xterminal, 'write');
    writeSpy.mockClear();

    terminalTextSignal.set('hello');
    TestBed.flushEffects();
    terminalTextSignal.set('hello world');
    TestBed.flushEffects();

    await vi.waitFor(() => {
      expect(writeSpy).toHaveBeenCalledWith('hello');
      expect(writeSpy).toHaveBeenCalledWith(' world');
    });
    expect(writeSpy).not.toHaveBeenCalledWith('hello world');
  });

  it('resets xterm and writes full text when terminalText prefix changes', async () => {
    const writeSpy = vi.spyOn(fixture.componentInstance.xterminal, 'write');
    const resetSpy = vi.spyOn(fixture.componentInstance.xterminal, 'reset');
    writeSpy.mockClear();
    resetSpy.mockClear();

    terminalTextSignal.set('abc');
    TestBed.flushEffects();
    await vi.waitFor(() => expect(writeSpy).toHaveBeenCalledWith('abc'));

    terminalTextSignal.set('x');
    TestBed.flushEffects();

    await vi.waitFor(() => {
      expect(resetSpy).toHaveBeenCalled();
      expect(writeSpy).toHaveBeenCalledWith('x');
    });
  });

  it('keeps ANSI/CR/TAB and normalizes LF to CRLF for xterm write', async () => {
    const writeSpy = vi.spyOn(fixture.componentInstance.xterminal, 'write');
    writeSpy.mockClear();

    const raw = '\u001b[2K\ra\tb\n$ ';
    terminalTextSignal.set(raw);
    TestBed.flushEffects();

    await vi.waitFor(() =>
      expect(writeSpy).toHaveBeenCalledWith('\u001b[2K\ra\tb\r\n$ '),
    );
  });

  it('skips re-emission when terminalText value is identical to previous', async () => {
    const writeSpy = vi.spyOn(fixture.componentInstance.xterminal, 'write');
    writeSpy.mockClear();

    terminalTextSignal.set('hello');
    TestBed.flushEffects();
    await vi.waitFor(() => expect(writeSpy).toHaveBeenCalledWith('hello'));

    writeSpy.mockClear();
    terminalTextSignal.set('hello');
    TestBed.flushEffects();

    await Promise.resolve();
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('treats fresh terminalText as full write after disconnect resets cache', async () => {
    const writeSpy = vi.spyOn(fixture.componentInstance.xterminal, 'write');
    writeSpy.mockClear();

    terminalTextSignal.set('hello');
    TestBed.flushEffects();
    await vi.waitFor(() => expect(writeSpy).toHaveBeenCalledWith('hello'));

    isConnectedSignal.set(false);
    TestBed.flushEffects();

    writeSpy.mockClear();
    isConnectedSignal.set(true);
    terminalTextSignal.set('');
    TestBed.flushEffects();
    terminalTextSignal.set('hello');
    TestBed.flushEffects();

    await vi.waitFor(() => expect(writeSpy).toHaveBeenCalledWith('hello'));
  });

});
