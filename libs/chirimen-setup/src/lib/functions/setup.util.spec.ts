import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT_SUBDIR } from '../constants';
import {
  isSetupReady,
  isValidNodeTarUrl,
  sanitizeProjectSubdir,
} from './setup.util';

describe('isValidNodeTarUrl', () => {
  it('accepts unofficial-builds https URL', () => {
    expect(
      isValidNodeTarUrl(
        'https://unofficial-builds.nodejs.org/download/release/v20.18.1/node-v20.18.1-linux-armv6l.tar.xz',
      ),
    ).toBe(true);
  });

  it('rejects other hosts', () => {
    expect(isValidNodeTarUrl('https://example.com/node.tar.xz')).toBe(false);
  });

  it('rejects empty', () => {
    expect(isValidNodeTarUrl('')).toBe(false);
  });
});

describe('sanitizeProjectSubdir', () => {
  it('strips unsafe characters', () => {
    expect(sanitizeProjectSubdir('pi/../zero')).toBe('pizero');
  });

  it('falls back to default when empty after sanitize', () => {
    expect(sanitizeProjectSubdir('@@@')).toBe(DEFAULT_PROJECT_SUBDIR);
  });
});

describe('isSetupReady', () => {
  it('returns true for valid node and npm versions', () => {
    expect(isSetupReady('v20.18.1', '10.8.2')).toBe(true);
  });

  it('returns false when node is missing', () => {
    expect(
      isSetupReady('-bash: node: command not found', '10.8.2'),
    ).toBe(false);
  });

  it('returns false when npm is missing', () => {
    expect(isSetupReady('v20.18.1', '-bash: npm: command not found')).toBe(
      false,
    );
  });

  it('ignores leading blank lines', () => {
    expect(isSetupReady('\n\nv22.0.0\n', '\n10.9.0\n')).toBe(true);
  });
});
