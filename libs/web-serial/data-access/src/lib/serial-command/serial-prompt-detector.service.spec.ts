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
