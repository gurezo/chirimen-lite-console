import { describe, expect, it } from 'vitest';
import { xtermConsoleTheme } from '../constants';
import { xtermConsoleConfigOptions } from './xterm-config';

describe('xtermConsoleConfigOptions', () => {
  it('uses the shared vscode-like theme palette', () => {
    expect(xtermConsoleConfigOptions.theme).toBe(xtermConsoleTheme);
    expect(xtermConsoleConfigOptions.theme?.background).toBe('#1e1e1e');
    expect(xtermConsoleConfigOptions.theme?.foreground).toBe('#d4d4d4');
    expect(xtermConsoleConfigOptions.theme?.green).toBe('#0dbc79');
    expect(xtermConsoleConfigOptions.theme?.brightBlue).toBe('#3b8eea');
    expect(xtermConsoleConfigOptions.theme?.selectionBackground).toBe(
      '#264f78',
    );
  });

  it('sets minimumContrastRatio on terminal options', () => {
    expect(xtermConsoleConfigOptions.minimumContrastRatio).toBe(4.5);
  });

  it('keeps existing cursor options', () => {
    expect(xtermConsoleConfigOptions.cursorBlink).toBe(true);
    expect(xtermConsoleConfigOptions.cursorStyle).toBe('underline');
    expect(xtermConsoleConfigOptions.cursorWidth).toBe(2);
  });
});
