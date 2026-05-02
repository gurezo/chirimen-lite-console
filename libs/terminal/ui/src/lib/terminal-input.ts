import { Terminal } from '@xterm/xterm';

type CommandHandler = (command: string) => Promise<string>;
type InputEnabledHandler = () => boolean;

/**
 * Attaches key input handling to an xterm Terminal instance.
 * Handles Enter, Backspace, and printable characters.
 */
export function attachTerminalInput(
  terminal: Terminal,
  onCommand?: CommandHandler,
  isInputEnabled?: InputEnabledHandler,
): void {
  let inputBuffer = '';

  terminal.onKey((e) => {
    const ev = e.domEvent;
    const inputEnabled = isInputEnabled ? isInputEnabled() : true;
    const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;

    // 未接続時は入力を完全に無視する（xterm 側の入力も出さない）
    if (!inputEnabled) {
      inputBuffer = '';
      return;
    }

    if (ev.code === 'Enter') {
      const command = inputBuffer.trim();
      terminal.write('\r\n');
      inputBuffer = '';

      if (!command) {
        return;
      }

      if (!onCommand) {
        terminal.writeln('(No command handler)');
        return;
      }

      void onCommand(command)
        .then((stdout) => {
          if (stdout) {
            terminal.write(stdout);
          }
        })
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : String(error);
          terminal.writeln(`\r\nCommand failed: ${message}`);
        });
    } else if (ev.code === 'Backspace') {
      if (inputBuffer.length > 0) {
        inputBuffer = inputBuffer.slice(0, -1);
      }
      terminal.write('\b \b'); // erase one char
    } else if (printable) {
      inputBuffer += ev.key;
      terminal.write(ev.key);
    }
  });
}
