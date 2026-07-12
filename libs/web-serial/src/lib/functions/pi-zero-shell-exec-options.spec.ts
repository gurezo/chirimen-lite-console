import { describe, expect, it } from 'vitest';
import { PiZeroPromptDetectorService } from '../service/pi-zero-prompt-detector.service';
import { createPiZeroShellExecOptions } from './pi-zero-shell-exec-options';
import { SERIAL_TIMEOUT } from './serial-timeout';

describe('createPiZeroShellExecOptions', () => {
  const detector = new PiZeroPromptDetectorService();

  it('uses promptMatch based on isLikelyLoggedInShellPrompt', () => {
    const options = createPiZeroShellExecOptions(detector);
    expect(options.prompt).toBe('');
    expect(options.promptMatch).toBeTypeOf('function');
    expect(options.promptMatch?.('pi@custom-host:~$ ')).toBe(true);
    expect(options.promptMatch?.('login: ')).toBe(false);
  });

  it('merges timeout and other overrides', () => {
    const options = createPiZeroShellExecOptions(detector, {
      timeout: SERIAL_TIMEOUT.LONG,
      retry: 2,
    });
    expect(options.timeout).toBe(SERIAL_TIMEOUT.LONG);
    expect(options.retry).toBe(2);
  });
});
