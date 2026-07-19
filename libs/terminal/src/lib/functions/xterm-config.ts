import { ITerminalInitOnlyOptions, ITerminalOptions } from '@xterm/xterm';
import { xtermConsoleTheme } from '../constants';

export type XtermConsoleConfigOptions = ITerminalOptions &
  ITerminalInitOnlyOptions;

export const xtermConsoleConfigOptions: XtermConsoleConfigOptions = {
  cursorBlink: true,
  cursorStyle: 'underline',
  cursorWidth: 2,
  minimumContrastRatio: 4.5,
  theme: xtermConsoleTheme,
};
