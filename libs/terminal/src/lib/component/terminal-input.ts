import { Terminal } from '@xterm/xterm';

type CommandHandler = (command: string) => void | Promise<void>;
type InputEnabledHandler = () => boolean;
type SendHandler = (data: string) => void;

const CSI_ARROW_UP = '\x1b[A';
const CSI_ARROW_DOWN = '\x1b[B';
const DEL_BACKSPACE = '\x7f';
/** ETX — remote shell SIGINT (Ctrl+C). */
const ETX_INTERRUPT = '\x03';

/**
 * Attaches key input handling to an xterm Terminal instance.
 * Sends keystrokes via {@link onSend} for remote shell interaction (no local echo).
 * Left/Right arrows are ignored per interactive console UX.
 * Ctrl+C sends ETX so foreground processes (e.g. node) can be interrupted.
 */
export function attachTerminalInput(
  terminal: Terminal,
  onCommand?: CommandHandler,
  isInputEnabled?: InputEnabledHandler,
  onSend?: SendHandler,
): void {
  let inputBuffer = '';

  const send = (data: string): void => {
    onSend?.(data);
  };

  terminal.onKey((e) => {
    const ev = e.domEvent;
    const inputEnabled = isInputEnabled ? isInputEnabled() : true;

    if (!inputEnabled) {
      inputBuffer = '';
      return;
    }

    if (ev.code === 'ArrowLeft' || ev.code === 'ArrowRight') {
      ev.preventDefault?.();
      return;
    }

    if (ev.code === 'ArrowUp') {
      ev.preventDefault?.();
      // Remote shell owns the line after history/completion; drop local tracking.
      inputBuffer = '';
      send(CSI_ARROW_UP);
      return;
    }

    if (ev.code === 'ArrowDown') {
      ev.preventDefault?.();
      inputBuffer = '';
      send(CSI_ARROW_DOWN);
      return;
    }

    if (ev.code === 'Tab') {
      ev.preventDefault?.();
      inputBuffer = '';
      send('\t');
      return;
    }

    if (ev.code === 'Enter') {
      ev.preventDefault?.();
      const command = inputBuffer.trim();
      inputBuffer = '';
      send('\r');
      if (command && onCommand) {
        void onCommand(command);
      }
      return;
    }

    if (ev.code === 'Backspace') {
      ev.preventDefault?.();
      if (inputBuffer.length > 0) {
        inputBuffer = inputBuffer.slice(0, -1);
      }
      send(DEL_BACKSPACE);
      return;
    }

    const isCtrlC =
      ev.ctrlKey &&
      !ev.altKey &&
      !ev.metaKey &&
      (ev.key === 'c' || ev.key === 'C' || ev.code === 'KeyC');

    if (isCtrlC) {
      ev.preventDefault?.();
      inputBuffer = '';
      send(ETX_INTERRUPT);
      return;
    }

    const printable =
      !ev.altKey &&
      !ev.ctrlKey &&
      !ev.metaKey &&
      ev.key.length === 1;

    if (printable) {
      inputBuffer += ev.key;
      send(ev.key);
    }
  });
}
