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
  it('keeps last segment after carriage return within a line', () => {
    expect(collapseCarriageRedrawsPerLine('foo\rbar')).toBe('bar');
  });

  it('normalizes CRLF then collapses per line', () => {
    expect(collapseCarriageRedrawsPerLine('a\r\nb\rc')).toBe('a\nc');
  });
});
