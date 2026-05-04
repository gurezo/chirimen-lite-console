import { describe, expect, it } from 'vitest';
import { matchesSerialPrompt } from './serial-prompt-match';

describe('matchesSerialPrompt', () => {
  it('matches substring prompt', () => {
    expect(
      matchesSerialPrompt('foo\r\npi@raspberrypi:~$ ', 'pi@raspberrypi'),
    ).toBe(true);
    expect(matchesSerialPrompt('no prompt here', 'pi@raspberrypi')).toBe(
      false,
    );
  });

  it('rejects user@host: on echoed command line (text after $)', () => {
    expect(
      matchesSerialPrompt(
        'pi@raspberrypi:~$ ls -la',
        'pi@raspberrypi:',
      ),
    ).toBe(false);
  });

  it('accepts idle user@host: line after command output', () => {
    expect(
      matchesSerialPrompt(
        'total 1\ndir\npi@raspberrypi:~$ ',
        'pi@raspberrypi:',
      ),
    ).toBe(true);
  });

  it('matches RegExp prompt', () => {
    const re = /login:\s*$/i;
    expect(matchesSerialPrompt('raspberrypi login: ', re)).toBe(true);
    expect(matchesSerialPrompt('welcome', re)).toBe(false);
  });

  it('resets RegExp lastIndex before each test', () => {
    const re = /^x$/g;
    expect(matchesSerialPrompt('x', re)).toBe(true);
    expect(matchesSerialPrompt('x', re)).toBe(true);
  });
});
