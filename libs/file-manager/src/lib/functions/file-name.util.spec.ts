import { describe, expect, it } from 'vitest';
import { isValidFileName } from './file-name.util';

describe('isValidFileName', () => {
  it('accepts a simple file name', () => {
    expect(isValidFileName('readme.txt')).toBe(true);
  });

  it('rejects empty or whitespace-only names', () => {
    expect(isValidFileName('')).toBe(false);
    expect(isValidFileName('   ')).toBe(false);
  });

  it('rejects . and ..', () => {
    expect(isValidFileName('.')).toBe(false);
    expect(isValidFileName('..')).toBe(false);
  });

  it('rejects names that contain a slash', () => {
    expect(isValidFileName('a/b')).toBe(false);
    expect(isValidFileName('/tmp')).toBe(false);
  });
});
