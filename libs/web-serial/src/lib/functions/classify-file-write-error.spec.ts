import { describe, expect, it } from 'vitest';
import { classifyFileWriteError } from './classify-file-write-error';

describe('classifyFileWriteError', () => {
  it('classifies disconnect / cancel', () => {
    expect(classifyFileWriteError(new Error('All commands cancelled')).message)
      .toContain('connection was lost or cancelled');
    expect(classifyFileWriteError(new Error('not connected')).message)
      .toContain('connection was lost or cancelled');
  });

  it('classifies timeout', () => {
    expect(
      classifyFileWriteError(new Error('Command execution timeout')).message,
    ).toContain('timed out');
  });

  it('classifies permission denied', () => {
    expect(
      classifyFileWriteError(new Error('Permission denied')).message,
    ).toContain('write permission was denied');
  });

  it('classifies disk full', () => {
    expect(
      classifyFileWriteError(new Error('No space left on device')).message,
    ).toContain('insufficient disk space');
  });

  it('classifies missing path', () => {
    expect(
      classifyFileWriteError(new Error('No such file or directory')).message,
    ).toContain('target path does not exist');
  });

  it('classifies verify mismatch', () => {
    expect(
      classifyFileWriteError(
        new Error('size mismatch: expected 3 bytes but got 1'),
      ).message,
    ).toContain('did not match');
  });

  it('preserves already classified Save failed messages', () => {
    const msg = 'Save failed: write permission was denied for the target file.';
    expect(classifyFileWriteError(new Error(msg)).message).toBe(msg);
  });
});
