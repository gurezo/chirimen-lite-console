#!/usr/bin/env node
/**
 * Issue #650 / parent #643: Web Serial の「アプリ境界」が data-access 内部実装に食い込まないことを検証する。
 *
 * - `SerialTransportService`（および `receive$` 橋渡しの低レイヤー）は `libs/web-serial/data-access` のみで import / DI されること。
 *
 * 逸脱があれば非ゼロ終了コードで終了する（CI 用）。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const EXCLUDED_PREFIX = 'libs/web-serial/data-access';

/** @param {string} relPosix */
function isExcluded(relPosix) {
  return (
    relPosix === EXCLUDED_PREFIX ||
    relPosix.startsWith(`${EXCLUDED_PREFIX}/`)
  );
}

/**
 * @param {string} relDir
 * @returns {Generator<string>}
 */
function* walkTsFiles(relDir) {
  const absDir = join(ROOT, relDir);
  let entries;
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const name = e.name;
    const rel = join(relDir, name);
    if (e.isDirectory()) {
      if (
        name === 'node_modules' ||
        name === 'dist' ||
        name === '.git' ||
        name === 'coverage'
      ) {
        continue;
      }
      yield* walkTsFiles(rel);
    } else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) {
      yield join(ROOT, rel);
    }
  }
}

/**
 * @param {string} absPath
 * @returns {string}
 */
function toPosixRel(absPath) {
  return relative(ROOT, absPath).split('\\').join('/');
}

/**
 * @param {string} text
 */
function usesSerialTransportService(text) {
  const importSerialTransport =
    /import\s+(?:[\s\S]*?\btype\s+)?(?:\{[\s\S]*?\bSerialTransportService\b[\s\S]*?\}|\bSerialTransportService\b)\s+from/.test(
      text,
    );
  const injectTransport = /inject\s*\(\s*SerialTransportService\s*\)/.test(
    text,
  );
  const provideTransport =
    /\{\s*provide:\s*SerialTransportService\b/.test(text);
  return importSerialTransport || injectTransport || provideTransport;
}

const violations = [];

for (const root of ['libs', 'apps']) {
  for (const absPath of walkTsFiles(root)) {
    const rel = toPosixRel(absPath);
    if (isExcluded(rel)) continue;

    const text = readFileSync(absPath, 'utf8');
    if (usesSerialTransportService(text)) {
      violations.push({
        file: rel,
        reason:
          'SerialTransportService は libs/web-serial/data-access 外から参照しない（SerialFacadeService 経由に統一する）',
      });
    }
  }
}

if (violations.length > 0) {
  console.error(
    'verify-serial-feature-boundary: 次のファイルが Web Serial の境界ルールに違反しています:\n',
  );
  for (const v of violations) {
    console.error(`  - ${v.file}\n    ${v.reason}`);
  }
  process.exit(1);
}

console.log(
  'verify-serial-feature-boundary: OK（libs/web-serial/data-access 外に SerialTransportService の import / provide はありません）',
);
