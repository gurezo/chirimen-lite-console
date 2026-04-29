import { describe, expect, it } from 'vitest';
import { SerialPromptDetectorService } from './serial-prompt-detector.service';

describe('SerialPromptDetectorService', () => {
  const detector = new SerialPromptDetectorService();

  it('matches substring prompt', () => {
    expect(
      detector.matchesPrompt('foo\r\npi@raspberrypi:~$ ', 'pi@raspberrypi'),
    ).toBe(true);
    expect(
      detector.matchesPrompt('no prompt here', 'pi@raspberrypi'),
    ).toBe(false);
  });

  it('matches RegExp prompt', () => {
    const re = /login:\s*$/i;
    expect(detector.matchesPrompt('raspberrypi login: ', re)).toBe(true);
    expect(detector.matchesPrompt('welcome', re)).toBe(false);
  });

  it('resets RegExp lastIndex before each test', () => {
    const re = /^x$/g;
    expect(detector.matchesPrompt('x', re)).toBe(true);
    expect(detector.matchesPrompt('x', re)).toBe(true);
  });
});
