import { describe, expect, it } from 'vitest';
import { stripSerialAnsiForPrompt } from '@libs-web-serial-util';
import { stripLineForPromptDetection } from './ansi-strip.util';

describe('stripLineForPromptDetection', () => {
  it('delegates to stripSerialAnsiForPrompt', () => {
    const raw = '\u001b[2J\u001b[Hraspberrypi login: ';
    expect(stripLineForPromptDetection(raw)).toBe(
      stripSerialAnsiForPrompt(raw),
    );
  });

  it('matches util for plain text', () => {
    const s = 'pi@raspberrypi:~$ ';
    expect(stripLineForPromptDetection(s)).toBe(stripSerialAnsiForPrompt(s));
  });
});
