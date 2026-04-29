import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NEVER, from, of } from 'rxjs';
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

  beforeEach(async () => {
    execMock = vi.fn().mockResolvedValue({
      stdout: `i2cdetect -y 1\n     0  1\n${PI_ZERO_PROMPT} `,
    });
    shouldRunAfterConnectMock = vi.fn(() => of(true));
    runAfterConnectMock = vi.fn(() => of(undefined));
    await TestBed.configureTestingModule({
      imports: [TerminalViewComponent],
    })
      .overrideProvider(SerialFacadeService, {
        useValue: {
          isConnected$: of(true),
          exec$: (...args: unknown[]) =>
            from(execMock(...(args as [string, unknown]))),
          connectionEstablished$: NEVER,
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
});
