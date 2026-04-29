import { describe, expect, it } from 'vitest';
import {
  collapseCarriageRedrawsPerLine,
  stripSerialAnsiForPrompt,
} from './serial-ansi';

describe('stripSerialAnsiForPrompt', () => {
  it('removes CSI color and cursor sequences so login line matches', () => {
    const raw =
      '\u001b[2J\u001b[H\u001b[0;1;32mRaspberry Pi\u001b[0m\r\nraspberrypi login: ';
    const cleaned = stripSerialAnsiForPrompt(raw);
    expect(cleaned).toMatch(/raspberrypi login:\s*$/m);
  });

  it('strips OSC sequences', () => {
    const s = '\u001b]0;pty\u0007raspberrypi login: ';
    expect(stripSerialAnsiForPrompt(s)).toBe('raspberrypi login: ');
  });
});

describe('collapseCarriageRedrawsPerLine', () => {
  it('TTY の同一行での \\r 重ね描きを最終セグメント 1 行に収束し naive \\r→\\n が生む段状行を防ぐ', () => {
    const raw =
      'total 36\n' +
      '        drwx------\r                                                  drwx------ 5 pi   pi   4096 Apr 11 07:56 .\n';
    const out = collapseCarriageRedrawsPerLine(raw.trimEnd());
    expect(out.split('\n')).toEqual([
      'total 36',
      '                                                  drwx------ 5 pi   pi   4096 Apr 11 07:56 .',
    ]);
    expect(out).not.toMatch(/\n\s{8}drwx------\n\s{20,}drwx/);
  });

  it('単独の \\r で区切られた行末は \\n に収束できる', () => {
    expect(collapseCarriageRedrawsPerLine('a\rb\nc')).toBe('b\nc');
  });
});
