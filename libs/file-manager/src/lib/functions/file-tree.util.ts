import { FileTreeNode } from '../models';

function normalizeDirectoryPath(path: string): string {
  if (!path || path === '.') {
    return '.';
  }
  return path.endsWith('/') ? path.slice(0, -1) : path;
}

function decodeQuotedName(raw: string): string {
  return raw.replace(/\\(["\\])/g, '$1');
}

export function joinPath(basePath: string, name: string): string {
  const base = normalizeDirectoryPath(basePath);
  if (base === '.') {
    return `./${name}`;
  }
  return `${base}/${name}`;
}

export function parseLsLine(
  line: string,
  basePath: string,
): FileTreeNode | null {
  if (!line || line.startsWith('total ') || line.startsWith('合計 ')) {
    return null;
  }

  const typeChar = line[0];
  const isDirectory = typeChar === 'd';
  const quotedNameMatch = line.match(
    /"((?:[^"\\]|\\.)*)"(?:\s+->\s+"(?:[^"\\]|\\.)*")?$/,
  );
  if (!quotedNameMatch) {
    return null;
  }

  const name = decodeQuotedName(quotedNameMatch[1]);
  if (name === '.' || name === '..') {
    return null;
  }

  return {
    name,
    path: joinPath(basePath, name),
    isDirectory,
  };
}

export function parseLsOutput(
  lines: string[],
  basePath: string,
): FileTreeNode[] {
  return lines
    .map((line) => parseLsLine(line.trim(), basePath))
    .filter((node): node is FileTreeNode => node !== null)
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
}
