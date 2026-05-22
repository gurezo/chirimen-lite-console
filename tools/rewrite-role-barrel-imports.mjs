import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const LIBS_DIR = join(ROOT, 'libs');

const ROLES = [
  'actions',
  'component',
  'constants',
  'dialogs',
  'guards',
  'effects',
  'functions',
  'models',
  'reducers',
  'selectors',
  'service',
  'states',
];

const ROLE_PATTERN = ROLES.join('|');
const IMPORT_PATTERN = new RegExp(
  `(\\bfrom\\s+|export\\s+(?:type\\s+)?\\{[^}]*\\}\\s+from\\s+)(['"])((?:\\.\\./)+)(${ROLE_PATTERN})/[^'"]+(\\2)`,
  'g',
);

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
  for (const entry of entries) {
    const rel = join(relDir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) {
        continue;
      }
      yield* walkTsFiles(rel);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      yield rel;
    }
  }
}

function rewrite(content) {
  return content.replace(
    IMPORT_PATTERN,
    (_match, prefix, quote, relPath, role, _closingQuote) =>
      `${prefix}${quote}${relPath}${role}${quote}`,
  );
}

let changedFiles = 0;

for (const relFile of walkTsFiles('libs')) {
  const absPath = join(ROOT, relFile);
  const original = readFileSync(absPath, 'utf8');
  const updated = rewrite(original);
  if (updated !== original) {
    writeFileSync(absPath, updated, 'utf8');
    changedFiles += 1;
    console.log(`updated ${relFile}`);
  }
}

console.log(`\nDone: ${changedFiles} file(s) updated.`);
