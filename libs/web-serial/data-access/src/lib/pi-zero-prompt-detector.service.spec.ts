import { describe, expect, it } from 'vitest';
import { PiZeroPromptDetectorService } from './pi-zero-prompt-detector.service';

describe('PiZeroPromptDetectorService', () => {
  const detector = new PiZeroPromptDetectorService();

  it('isLoginPrompt detects English login line', () => {
    expect(detector.isLoginPrompt('raspberrypi login: ')).toBe(true);
    expect(detector.isLoginPrompt('foo\nraspberrypi login: ')).toBe(true);
    expect(detector.isLoginPrompt('welcome')).toBe(false);
  });

  it('isLoginPrompt detects Japanese login line', () => {
    expect(detector.isLoginPrompt('ホスト名 ログイン: ')).toBe(true);
  });

  it('isPasswordPrompt detects password prompt at line end', () => {
    expect(detector.isPasswordPrompt('Password: ')).toBe(true);
    expect(detector.isPasswordPrompt('password:\r\n')).toBe(true);
    expect(detector.isPasswordPrompt('not password')).toBe(false);
  });

  it('isShellPrompt accepts pi@hostname:', () => {
    expect(detector.isShellPrompt('pi@raspberrypi:~$ ')).toBe(true);
    expect(detector.isShellPrompt('out\npi@chirimen:')).toBe(true);
    expect(detector.isShellPrompt('root@host:~# ')).toBe(false);
  });

  it('isLikelyLoggedInShellPrompt accepts common user@host shell lines', () => {
    expect(detector.isLikelyLoggedInShellPrompt('pi@raspberrypi:~$ ')).toBe(
      true,
    );
    expect(
      detector.isLikelyLoggedInShellPrompt('boot\nroot@raspberrypi:~# '),
    ).toBe(true);
    expect(detector.isLikelyLoggedInShellPrompt('kernel: blah')).toBe(false);
  });

  it('isLikelyLoggedInShellPrompt finds pi@ line after Last login motd', () => {
    expect(
      detector.isLikelyLoggedInShellPrompt(
        'Last login: Mon Jan 01 00:00:00 2024\nLinux raspberrypi\npi@raspberrypi:~$ ',
      ),
    ).toBe(true);
  });

  it('isLikelyLoggedInShellPrompt accepts empty path pi@host:$', () => {
    expect(detector.isLikelyLoggedInShellPrompt('foo\npi@raspberrypi:$')).toBe(
      true,
    );
  });

  it('isCommandCompleted matches shell prompt return', () => {
    expect(detector.isCommandCompleted('pi@raspberrypi:~$ ')).toBe(true);
    expect(detector.isCommandCompleted('\nroot@raspberrypi:~# ')).toBe(true);
    expect(detector.isCommandCompleted('running…')).toBe(false);
  });

  it('isAwaitingLoginName uses trailing line only', () => {
    expect(detector.isAwaitingLoginName('boot\nfoo login: ')).toBe(true);
    expect(
      detector.isAwaitingLoginName('foo login:\nPassword: '),
    ).toBe(false);
  });

  it('isAwaitingPasswordInput uses trailing line only', () => {
    expect(detector.isAwaitingPasswordInput('Password: ')).toBe(true);
    expect(
      detector.isAwaitingPasswordInput('foo login:\nPassword: '),
    ).toBe(true);
  });
});
