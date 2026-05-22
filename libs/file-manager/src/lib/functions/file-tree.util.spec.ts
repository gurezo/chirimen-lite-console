import { describe, expect, it } from 'vitest';
import { parseLsLine, parseLsOutput } from './file-tree.util';

describe('file-tree util', () => {
  it('parses a file entry', () => {
    const node = parseLsLine(
      '-rw-r--r-- 1 pi pi 120 Mar 20 10:00 "main.ts"',
      '.',
    );
    expect(node).toEqual({
      name: 'main.ts',
      path: './main.ts',
      isDirectory: false,
    });
  });

  it('ignores total and dot entries', () => {
    expect(parseLsLine('total 12', '.')).toBeNull();
    expect(
      parseLsLine('drwxr-xr-x 2 pi pi 4096 Mar 20 10:00 "."', '.'),
    ).toBeNull();
    expect(
      parseLsLine('drwxr-xr-x 2 pi pi 4096 Mar 20 10:00 ".."', '.'),
    ).toBeNull();
  });

  it('sorts directories before files', () => {
    const output = parseLsOutput(
      [
        '-rw-r--r-- 1 pi pi 10 Mar 20 10:00 "b.txt"',
        'drwxr-xr-x 2 pi pi 4096 Mar 20 10:00 "dir"',
        '-rw-r--r-- 1 pi pi 10 Mar 20 10:00 "a.txt"',
      ],
      '.',
    );

    expect(output.map((entry) => entry.name)).toEqual(['dir', 'a.txt', 'b.txt']);
  });
});
