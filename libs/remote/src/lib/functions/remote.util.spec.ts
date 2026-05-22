import { describe, expect, it } from 'vitest';
import { formatRemoteStatus, parseForeverListPlain } from './remote.util';

describe('formatRemoteStatus', () => {
  it('trims and drops blank lines', () => {
    expect(formatRemoteStatus('  a \n\n b  ')).toBe('a\nb');
  });
});

describe('parseForeverListPlain', () => {
  it('returns empty array for empty input', () => {
    expect(parseForeverListPlain('')).toEqual([]);
    expect(parseForeverListPlain('   ')).toEqual([]);
  });

  it('returns empty when no processes message', () => {
    expect(parseForeverListPlain('No forever processes running')).toEqual([]);
    expect(
      parseForeverListPlain('info: No forever processes running'),
    ).toEqual([]);
  });

  it('parses typical cliff-style rows (2+ spaces between columns)', () => {
    const stdout = `
Forever processes running
[0]  RelayServer  node  /home/pi/RelayServer.js  1111  2222  /tmp/a.log  0:0:0:1
[1]  other  node  /app/server.js  3333  4444  /tmp/b.log  0:1:2:3
`;
    const rows = parseForeverListPlain(stdout);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      listIndex: 0,
      uid: 'RelayServer',
      command: 'node',
      script: '/home/pi/RelayServer.js',
      foreverPid: '1111',
      pid: '2222',
      logFile: '/tmp/a.log',
      running: true,
    });
    expect(rows[1]?.listIndex).toBe(1);
    expect(rows[1]?.uid).toBe('other');
  });

  it('marks stopped when STOPPED appears in row', () => {
    const stdout =
      '[0]  app  node  /x.js  1  2  /l.log  STOPPED';
    const rows = parseForeverListPlain(stdout);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.running).toBe(false);
  });

  it('strips ANSI color sequences', () => {
    const red = '\u001b[31m';
    const reset = '\u001b[39m';
    const stdout = `[0]  u  node  /p.js  1  2  /l.log  ${red}STOPPED${reset}`;
    const rows = parseForeverListPlain(stdout);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.running).toBe(false);
  });

  it('skips header lines and junk', () => {
    const stdout = `  uid  command  script
not a row
[0]  a  node  /a.js  1  2  /l.log  0:0:0:1
`;
    const rows = parseForeverListPlain(stdout);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.uid).toBe('a');
  });

  it('ignores rows with too few columns after split', () => {
    expect(parseForeverListPlain('[0]  onlyone')).toEqual([]);
  });
});
