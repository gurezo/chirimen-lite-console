import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT_SUBDIR } from '../constants/setup.constants';
import {
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
