import { describe, expect, it } from 'vitest';
import { SerialPromptDetectorService } from './serial-prompt-detector.service';

describe('SerialPromptDetectorService', () => {
  const detector = new SerialPromptDetectorService();

  it('matches substring prompt', () => {
    expect(
      detector.matchesPrompt('foo\r\npi@raspberrypi:~$ ', 'pi@raspberrypi'),
    ).toBe(true);
    expect(detector.matchesPrompt('no prompt here', 'pi@raspberrypi')).toBe(
      false,
    );
  });

  it('matchesPrompt rejects user@host: on echoed command line (text after $)', () => {
    expect(
      detector.matchesPrompt(
        'pi@raspberrypi:~$ ls -la',
        'pi@raspberrypi:',
      ),
    ).toBe(false);
  });

  it('matchesPrompt accepts idle user@host: line after command output', () => {
    expect(
      detector.matchesPrompt(
        'total 1\ndir\npi@raspberrypi:~$ ',
        'pi@raspberrypi:',
      ),
    ).toBe(true);
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
