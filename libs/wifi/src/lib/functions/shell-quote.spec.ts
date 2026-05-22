/// <reference types="vitest/globals" />
import { shellSingleQuote } from './shell-quote';

describe('shellSingleQuote', () => {
  it('wraps plain strings in single quotes', () => {
    expect(shellSingleQuote('foo')).toBe("'foo'");
  });

  it('escapes embedded single quotes for POSIX sh', () => {
    expect(shellSingleQuote("a'b")).toBe(`'a'\\''b'`);
  });

  it('handles empty string', () => {
    expect(shellSingleQuote('')).toBe("''");
  });
});
