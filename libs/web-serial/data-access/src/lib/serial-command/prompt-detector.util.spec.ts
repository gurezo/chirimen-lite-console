import { describe, expect, it } from 'vitest';
import { matchesPrompt } from './prompt-detector.util';

describe('matchesPrompt', () => {
  it('matches substring prompt', () => {
    expect(matchesPrompt('foo\r\npi@raspberrypi:~$ ', 'pi@raspberrypi')).toBe(
      true,
    );
    expect(matchesPrompt('no prompt here', 'pi@raspberrypi')).toBe(false);
  });

  it('matches RegExp prompt', () => {
    const re = /login:\s*$/i;
    expect(matchesPrompt('raspberrypi login: ', re)).toBe(true);
    expect(matchesPrompt('welcome', re)).toBe(false);
  });

  it('resets RegExp lastIndex before each test', () => {
    const re = /^x$/g;
    expect(matchesPrompt('x', re)).toBe(true);
    expect(matchesPrompt('x', re)).toBe(true);
  });
});
