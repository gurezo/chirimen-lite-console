import { describe, expect, it, vi } from 'vitest';
import { attachTerminalInput } from './terminal-input';

type DomEvent = {
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  code: string;
  key: string;
  preventDefault: () => void;
};

type TerminalKeyEvent = {
  domEvent: DomEvent;
};

function createDomEvent(
  partial: Pick<DomEvent, 'code' | 'key'> &
    Partial<Pick<DomEvent, 'altKey' | 'ctrlKey' | 'metaKey'>>,
): DomEvent {
  return {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    ...partial,
  };
}

describe('attachTerminalInput', () => {
  it('ignores input when input is disabled', () => {
    let keyHandler: ((e: TerminalKeyEvent) => void) | undefined;
    const onSend = vi.fn();
    const onCommand = vi.fn();

    const terminal = {
      onKey: (cb: (e: TerminalKeyEvent) => void) => {
        keyHandler = cb;
      },
      write: vi.fn(),
      writeln: vi.fn(),
    } as unknown as Parameters<typeof attachTerminalInput>[0];

    attachTerminalInput(terminal, onCommand, () => false, onSend);

    keyHandler?.({
      domEvent: createDomEvent({ code: 'KeyL', key: 'l' }),
    });
    keyHandler?.({
      domEvent: createDomEvent({ code: 'Enter', key: 'Enter' }),
    });

    expect(onCommand).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
    expect(terminal.write).not.toHaveBeenCalled();
  });

  it('sends printable characters without local echo', () => {
    let keyHandler: ((e: TerminalKeyEvent) => void) | undefined;
    const onSend = vi.fn();

    const terminal = {
      onKey: (cb: (e: TerminalKeyEvent) => void) => {
        keyHandler = cb;
      },
      write: vi.fn(),
      writeln: vi.fn(),
    } as unknown as Parameters<typeof attachTerminalInput>[0];

    attachTerminalInput(terminal, undefined, () => true, onSend);

    keyHandler?.({
      domEvent: createDomEvent({ code: 'KeyL', key: 'l' }),
    });
    keyHandler?.({
      domEvent: createDomEvent({ code: 'KeyS', key: 's' }),
    });

    expect(onSend).toHaveBeenCalledWith('l');
    expect(onSend).toHaveBeenCalledWith('s');
    expect(terminal.write).not.toHaveBeenCalled();
  });

  it('sends carriage return and notifies command on Enter', () => {
    let keyHandler: ((e: TerminalKeyEvent) => void) | undefined;
    const onSend = vi.fn();
    const onCommand = vi.fn();

    const terminal = {
      onKey: (cb: (e: TerminalKeyEvent) => void) => {
        keyHandler = cb;
      },
      write: vi.fn(),
      writeln: vi.fn(),
    } as unknown as Parameters<typeof attachTerminalInput>[0];

    attachTerminalInput(terminal, onCommand, () => true, onSend);

    keyHandler?.({
      domEvent: createDomEvent({ code: 'KeyL', key: 'l' }),
    });
    keyHandler?.({
      domEvent: createDomEvent({ code: 'KeyS', key: 's' }),
    });
    keyHandler?.({
      domEvent: createDomEvent({ code: 'Enter', key: 'Enter' }),
    });

    expect(onSend).toHaveBeenCalledWith('l');
    expect(onSend).toHaveBeenCalledWith('s');
    expect(onSend).toHaveBeenCalledWith('\r');
    expect(onCommand).toHaveBeenCalledWith('ls');
    expect(terminal.write).not.toHaveBeenCalled();
  });

  it('sends tab as \\t and does not write key name', () => {
    let keyHandler: ((e: TerminalKeyEvent) => void) | undefined;
    const onSend = vi.fn();

    const terminal = {
      onKey: (cb: (e: TerminalKeyEvent) => void) => {
        keyHandler = cb;
      },
      write: vi.fn(),
      writeln: vi.fn(),
    } as unknown as Parameters<typeof attachTerminalInput>[0];

    attachTerminalInput(terminal, undefined, () => true, onSend);

    keyHandler?.({
      domEvent: createDomEvent({ code: 'Tab', key: 'Tab' }),
    });

    expect(onSend).toHaveBeenCalledWith('\t');
    expect(onSend).not.toHaveBeenCalledWith('Tab');
    expect(terminal.write).not.toHaveBeenCalled();
  });

  it('sends CSI sequences for up/down arrows', () => {
    let keyHandler: ((e: TerminalKeyEvent) => void) | undefined;
    const onSend = vi.fn();

    const terminal = {
      onKey: (cb: (e: TerminalKeyEvent) => void) => {
        keyHandler = cb;
      },
      write: vi.fn(),
      writeln: vi.fn(),
    } as unknown as Parameters<typeof attachTerminalInput>[0];

    attachTerminalInput(terminal, undefined, () => true, onSend);

    keyHandler?.({
      domEvent: createDomEvent({ code: 'ArrowUp', key: 'ArrowUp' }),
    });
    keyHandler?.({
      domEvent: createDomEvent({ code: 'ArrowDown', key: 'ArrowDown' }),
    });

    expect(onSend).toHaveBeenCalledWith('\x1b[A');
    expect(onSend).toHaveBeenCalledWith('\x1b[B');
    expect(onSend).not.toHaveBeenCalledWith('ArrowUp');
    expect(onSend).not.toHaveBeenCalledWith('ArrowDown');
    expect(terminal.write).not.toHaveBeenCalled();
  });

  it('ignores left/right arrows', () => {
    let keyHandler: ((e: TerminalKeyEvent) => void) | undefined;
    const onSend = vi.fn();

    const terminal = {
      onKey: (cb: (e: TerminalKeyEvent) => void) => {
        keyHandler = cb;
      },
      write: vi.fn(),
      writeln: vi.fn(),
    } as unknown as Parameters<typeof attachTerminalInput>[0];

    attachTerminalInput(terminal, undefined, () => true, onSend);

    keyHandler?.({
      domEvent: createDomEvent({ code: 'ArrowLeft', key: 'ArrowLeft' }),
    });
    keyHandler?.({
      domEvent: createDomEvent({ code: 'ArrowRight', key: 'ArrowRight' }),
    });

    expect(onSend).not.toHaveBeenCalled();
    expect(terminal.write).not.toHaveBeenCalled();
  });

  it('sends DEL for Backspace', () => {
    let keyHandler: ((e: TerminalKeyEvent) => void) | undefined;
    const onSend = vi.fn();

    const terminal = {
      onKey: (cb: (e: TerminalKeyEvent) => void) => {
        keyHandler = cb;
      },
      write: vi.fn(),
      writeln: vi.fn(),
    } as unknown as Parameters<typeof attachTerminalInput>[0];

    attachTerminalInput(terminal, undefined, () => true, onSend);

    keyHandler?.({
      domEvent: createDomEvent({ code: 'KeyA', key: 'a' }),
    });
    keyHandler?.({
      domEvent: createDomEvent({ code: 'Backspace', key: 'Backspace' }),
    });

    expect(onSend).toHaveBeenCalledWith('a');
    expect(onSend).toHaveBeenCalledWith('\x7f');
    expect(terminal.write).not.toHaveBeenCalled();
  });
});
