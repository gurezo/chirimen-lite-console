import { describe, expect, it } from 'vitest';
import { stripSerialAnsiForPrompt } from './serial-ansi';
import { PI_ZERO_SERIAL_LOGIN_LINE_PATTERN } from './pi-zero.const';

describe('stripSerialAnsiForPrompt', () => {
  it('removes CSI color and cursor sequences so login line matches', () => {
    const raw =
      '\u001b[2J\u001b[H\u001b[0;1;32mRaspberry Pi\u001b[0m\r\nraspberrypi login: ';
    const cleaned = stripSerialAnsiForPrompt(raw);
    expect(PI_ZERO_SERIAL_LOGIN_LINE_PATTERN.test(cleaned)).toBe(true);
  });

  it('strips OSC sequences', () => {
    const s = '\u001b]0;pty\u0007raspberrypi login: ';
    expect(stripSerialAnsiForPrompt(s)).toBe('raspberrypi login: ');
  });
});
