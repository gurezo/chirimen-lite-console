import { describe, expect, it } from 'vitest';
import { sanitizeSerialStdout } from './sanitize-serial-stdout';

describe('sanitizeSerialStdout', () => {
  it('removes echoed command and trailing prompt', () => {
    const raw =
      'i2cdetect -y 1\n     0  1  2  3\npi@chirimen:~ $ ';
    const out = sanitizeSerialStdout(raw, 'i2cdetect -y 1', 'pi@chirimen:~ $ ');
    expect(out).toContain('0  1  2  3');
    expect(out).not.toContain('pi@chirimen');
  });

  it('removes literal carriage returns from exec stdout', () => {
    const raw =
      'ls -la\n合計 36\n     drwx------ 1 pi\n-rw-r--r-- 2 pi\npi@raspberrypi:';
    const out = sanitizeSerialStdout(raw, 'ls -la', 'pi@raspberrypi:');
    expect(out).not.toContain('\r');
    expect(out).toContain('合計 36');
    expect(out).toContain('drwx------');
  });

  it('strips lone \\r characters without TTY collapse (terminalText$ owns redraw)', () => {
    const raw =
      'total 36\n' +
      '     x\r       y\rdrwx------ 1 pi ok\npi@host:';
    const out = sanitizeSerialStdout(raw, 'ls', 'pi@host:');
    expect(out).not.toContain('\r');
    expect(out).toContain('drwx------ 1 pi ok');
  });

  it('expands tabs after strip for xterm column alignment', () => {
    const raw = 'ls\na\tb\npi@raspberrypi:';
    const out = sanitizeSerialStdout(raw, 'ls', 'pi@raspberrypi:');
    expect(out).not.toContain('\t');
    expect(out).toContain('a       b'); // tab width 8, one char before tab → 7 spaces
  });

  it('strips CSI and DECSC sequences so xterm output is not staircase-like', () => {
    const raw =
      'ls -la\n' +
      '合計 36\n' +
      'preface\u001b7\u001b8\rdrwx------\n' +
      '\u001b[2K\r     drwx\n' +
      'pi@raspberrypi:';
    const out = sanitizeSerialStdout(raw, 'ls -la', 'pi@raspberrypi:');
    expect(out.includes(String.fromCharCode(0x1b))).toBe(false);
    expect(out).not.toContain('\r');
    expect(out).toContain('合計 36');
    expect(out).toContain('drwx');
  });

  it('drops a second echoed command line left after the first strip', () => {
    const raw =
      'ls -la\npi@raspberrypi:~$ ls -la\n合計 36\ndrwx\npi@raspberrypi:';
    const out = sanitizeSerialStdout(raw, 'ls -la', 'pi@raspberrypi:');
    expect(out).toBe('合計 36\ndrwx');
  });

  it('dedents ls -l-style lines when CR jitter left leading spaces', () => {
    const raw =
      '合計 36\n       drwx------ 5 pi pi 4096 .\npi@raspberrypi:';
    const out = sanitizeSerialStdout(
      raw,
      "LC_ALL=C LANG=C TERM=dumb LS_COLORS= ls -1 -la </dev/null 2>&1 | sed 's/^[[:blank:]]*//' | cat",
      'pi@raspberrypi:',
    );
    expect(out).toBe('合計 36\ndrwx------ 5 pi pi 4096 .');
  });

  it('strips coerced ls even when UART splits the echoed command across line breaks', () => {
    const cmd =
      "LC_ALL=C LANG=C TERM=dumb LS_COLORS= ls -1 -la </dev/null 2>&1 | sed 's/^[[:blank:]]*//' | cat";
    const raw =
      'stale block before echo\ntotal 36\njunk\n' +
      'LC_ALL=C LANG=C TERM=dumb\n' +
      'LS_COLORS= ls -1 -la </dev/null 2>&1\n' +
      "| sed 's/^[[:blank:]]*//' | cat\n" +
      'total 36\ndrwx------ 5 pi\npi@raspberrypi:~$ ';
    const out = sanitizeSerialStdout(raw, cmd, 'pi@raspberrypi:~$ ');
    expect(out).not.toContain('stale');
    expect(out).not.toContain('junk');
    expect(out).not.toContain('LC_ALL=');
    expect(out).toBe('total 36\ndrwx------ 5 pi');
  });

  it('strips echo and prompt from simple A\\rB\\rC line (no collapse; \\r removed)', () => {
    const prompt = 'pi@p:$ ';
    const raw = 'A\rB\rC\n' + prompt;
    expect(sanitizeSerialStdout(raw, 'echo', prompt).trim()).toBe('ABC');
  });

  it('does not trim indented non-ls lines', () => {
    const raw = '  hello world\npi@raspberrypi:';
    const out = sanitizeSerialStdout(raw, 'echo hi', 'pi@raspberrypi:');
    expect(out).toBe('  hello world');
  });

  it('trims leading spaces on every ls output line (CR jitter stairs)', () => {
    const cmd =
      "LC_ALL=C LANG=C TERM=dumb LS_COLORS= ls -1 -la </dev/null 2>&1 | sed 's/^[[:blank:]]*//' | cat";
    const raw =
      'total 40\n' +
      '        drwx------ 5 pi pi 4096 .\n' +
      '                                                  drwxr-xr-x 3 root root 4096 ..\n' +
      'pi@raspberrypi:~$ ';
    const out = sanitizeSerialStdout(raw, cmd, 'pi@raspberrypi:~$ ');
    expect(out).toBe(
      'total 40\ndrwx------ 5 pi pi 4096 .\ndrwxr-xr-x 3 root root 4096 ..',
    );
  });

  it('collapses intra-line \\r for ls before trim (TTY column redraw)', () => {
    const cmd =
      "LC_ALL=C LANG=C TERM=dumb LS_COLORS= ls -1 -la </dev/null 2>&1 | sed 's/^[[:blank:]]*//' | cat";
    const raw =
      'total 40\n' +
      '     drwx------\r        drwx------ 5 pi pi 4096 .\n' +
      'pi@raspberrypi:~$ ';
    const out = sanitizeSerialStdout(raw, cmd, 'pi@raspberrypi:~$ ');
    expect(out).toBe('total 40\ndrwx------ 5 pi pi 4096 .');
  });
});
