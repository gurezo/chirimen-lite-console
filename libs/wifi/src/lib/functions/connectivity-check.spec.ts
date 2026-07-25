/// <reference types="vitest/globals" />
import { parseConnectivityCheckResult } from './connectivity-check';

describe('parseConnectivityCheckResult', () => {
  it('returns ok when stdout contains 200 OK', () => {
    const stdout = [
      'wget --spider -nv https://tutorial.chirimen.org/',
      '2024-07-23 14:18:21 URL: https://tutorial.chirimen.org/ 200 OK',
      'pi@raspberrypi:~$',
    ].join('\n');
    expect(parseConnectivityCheckResult(stdout)).toBe('ok');
  });

  it('returns ok when stdout contains remote file exists', () => {
    expect(
      parseConnectivityCheckResult(
        'https://tutorial.chirimen.org/:\nRemote file exists.',
      ),
    ).toBe('ok');
  });

  it('returns ng for failure-like wget output', () => {
    expect(
      parseConnectivityCheckResult(
        'wget: unable to resolve host address ‘tutorial.chirimen.org’',
      ),
    ).toBe('ng');
  });

  it('returns ng for empty stdout', () => {
    expect(parseConnectivityCheckResult('')).toBe('ng');
    expect(parseConnectivityCheckResult('   ')).toBe('ng');
  });
});
