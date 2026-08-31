import { describe, expect, it } from 'vitest';
import { TruncatePipe } from './truncate.pipe';

describe('TruncatePipe', () => {
  const pipe = new TruncatePipe();

  it('returns empty string for nullish values', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  it('returns the original string when within the limit', () => {
    expect(pipe.transform('short')).toBe('short');
  });

  it('truncates and appends a trail when over the limit', () => {
    const value = 'a'.repeat(61);
    expect(pipe.transform(value)).toBe(`${'a'.repeat(60)}...`);
  });
});
