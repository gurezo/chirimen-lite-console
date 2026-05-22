import { describe, expect, it, vi } from 'vitest';
import { attachTerminalInput } from './terminal-input';

type DomEvent = {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  code: string;
  key: string;
};

type TerminalKeyEvent = {
  domEvent: DomEvent;
};

describe('attachTerminalInput', () => {
  it('ignores input when input is disabled', () => {
    let keyHandler: ((e: TerminalKeyEvent) => void) | undefined;

    const terminal = {
      onKey: (cb: (e: TerminalKeyEvent) => void) => {
        keyHandler = cb;
      },
      write: vi.fn(),
      writeln: vi.fn(),
    } as unknown as Parameters<typeof attachTerminalInput>[0];

    const onCommand = vi.fn(async () => 'OK');

    attachTerminalInput(terminal, onCommand, () => false);

    keyHandler?.({
      domEvent: {
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        code: 'KeyL',
        key: 'l',
      },
    });
    keyHandler?.({
      domEvent: {
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        code: 'Enter',
        key: 'Enter',
      },
    });

    expect(onCommand).not.toHaveBeenCalled();
    expect(terminal.write).not.toHaveBeenCalled();
    expect(terminal.writeln).not.toHaveBeenCalled();
  });

  it('executes command when input is enabled', async () => {
    let keyHandler: ((e: TerminalKeyEvent) => void) | undefined;

    const terminal = {
      onKey: (cb: (e: TerminalKeyEvent) => void) => {
        keyHandler = cb;
      },
      write: vi.fn(),
      writeln: vi.fn(),
    } as unknown as Parameters<typeof attachTerminalInput>[0];

    let resolveCommand: ((value: string) => void) | undefined;
    const onCommand = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveCommand = resolve;
        }),
    );

    attachTerminalInput(terminal, onCommand, () => true);

    keyHandler?.({
      domEvent: {
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        code: 'KeyL',
        key: 'l',
      },
    });
    keyHandler?.({
      domEvent: {
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        code: 'KeyS',
        key: 's',
      },
    });
    keyHandler?.({
      domEvent: {
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        code: 'Enter',
        key: 'Enter',
      },
    });

    expect(onCommand).toHaveBeenCalledWith('ls');

    resolveCommand?.('OK');
    await new Promise((r) => setTimeout(r, 0));

    expect(terminal.write).toHaveBeenCalledWith('OK');
  });
});

