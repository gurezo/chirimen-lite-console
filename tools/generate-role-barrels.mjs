import { readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROLE_FOLDERS = [
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

const ROOT = path.resolve(import.meta.dirname, '..');
const LIBS_DIR = path.join(ROOT, 'libs');

async function collectTsModules(dir, baseDir = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const modules = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      modules.push(...(await collectTsModules(fullPath, baseDir)));
      continue;
    }
    if (!entry.name.endsWith('.ts')) {
      continue;
    }
    if (entry.name.endsWith('.spec.ts') || entry.name === 'index.ts') {
      continue;
    }
    if (entry.name.endsWith('.stories.ts')) {
      continue;
    }
    const relative = path
      .relative(baseDir, fullPath)
      .replace(/\.ts$/, '')
      .split(path.sep)
      .join('/');
    modules.push(relative);
  }

  return modules.sort();
}

async function generateBarrel(roleDir) {
  const modules = await collectTsModules(roleDir);
  const lines = modules.map((mod) => `export * from './${mod}';`);

  if (lines.length === 0) {
    lines.push('export {};');
  }

  const content = `${lines.join('\n')}\n`;
  await writeFile(path.join(roleDir, 'index.ts'), content, 'utf8');
}

async function main() {
  const libs = await readdir(LIBS_DIR, { withFileTypes: true });
  let count = 0;

  for (const lib of libs) {
    if (!lib.isDirectory()) {
      continue;
    }
    const libRoot = path.join(LIBS_DIR, lib.name, 'src', 'lib');
    try {
      await stat(libRoot);
    } catch {
      continue;
    }

    for (const role of ROLE_FOLDERS) {
      const roleDir = path.join(libRoot, role);
      try {
        const roleStat = await stat(roleDir);
        if (!roleStat.isDirectory()) {
          continue;
        }
      } catch {
        continue;
      }

      await generateBarrel(roleDir);
      count += 1;
      console.log(`generated ${path.relative(ROOT, path.join(roleDir, 'index.ts'))}`);
    }
  }

  console.log(`\nDone: ${count} barrel file(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
