import { describe, expect, it } from 'vitest';
import {
  basenameOfPath,
  buildMoveDestination,
  canMoveNode,
  fileTreeNodeFromPath,
  parentPathOf,
  parseLsLine,
  parseLsOutput,
} from './file-tree.util';

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
    expect(parseLsLine('合計 36', '.')).toBeNull();
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

  it('resolves parent paths', () => {
    expect(parentPathOf('./main.ts')).toBe('.');
    expect(parentPathOf('./docs')).toBe('.');
    expect(parentPathOf('./docs/readme.md')).toBe('./docs');
    expect(parentPathOf('.')).toBe('.');
  });

  it('builds move destinations under the target directory', () => {
    expect(buildMoveDestination({ name: 'main.ts' }, './docs')).toBe(
      './docs/main.ts',
    );
    expect(buildMoveDestination({ name: 'main.ts' }, '.')).toBe('./main.ts');
  });

  it('resolves basename of paths', () => {
    expect(basenameOfPath('./docs/readme.md')).toBe('readme.md');
    expect(basenameOfPath('./docs')).toBe('docs');
    expect(basenameOfPath('.')).toBe('');
    expect(basenameOfPath('/app/src/main.js')).toBe('main.js');
  });

  it('builds a synthetic tree node from a path', () => {
    expect(fileTreeNodeFromPath('./docs/main.ts')).toEqual({
      name: 'main.ts',
      path: './docs/main.ts',
      isDirectory: false,
    });
  });

  it('rejects moving a node onto itself', () => {
    expect(canMoveNode({ path: './docs' }, './docs')).toBe(false);
    expect(canMoveNode({ path: './docs/' }, './docs')).toBe(false);
    expect(canMoveNode({ path: './main.ts' }, './docs')).toBe(true);
    expect(canMoveNode({ path: './docs' }, '.')).toBe(true);
  });
});
