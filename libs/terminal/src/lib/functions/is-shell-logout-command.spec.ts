import { describe, expect, it } from 'vitest';
import { isShellLogoutCommand } from './is-shell-logout-command';

describe('isShellLogoutCommand', () => {
  it('matches logout and exit ignoring case and surrounding spaces', () => {
    expect(isShellLogoutCommand('logout')).toBe(true);
    expect(isShellLogoutCommand('EXIT')).toBe(true);
    expect(isShellLogoutCommand('  logout  ')).toBe(true);
  });

  it('rejects other commands', () => {
    expect(isShellLogoutCommand('ls')).toBe(false);
    expect(isShellLogoutCommand('logout now')).toBe(false);
    expect(isShellLogoutCommand('')).toBe(false);
  });
});
