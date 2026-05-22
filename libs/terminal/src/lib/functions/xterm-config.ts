import { ITerminalInitOnlyOptions, ITerminalOptions } from '@xterm/xterm';

export type XtermConsoleConfigOptions = ITerminalOptions &
  ITerminalInitOnlyOptions;

export const xtermConsoleConfigOptions: XtermConsoleConfigOptions = {
  cursorBlink: true,
  cursorStyle: 'underline',
  cursorWidth: 2,
  theme: {
    background: 'black',
  },
};
