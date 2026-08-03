/// <reference types="vitest/globals" />
import { resolveEditorLanguage } from './resolve-editor-language';

describe('resolveEditorLanguage', () => {
  it.each([
    ['main.js', 'javascript', 'JavaScript'],
    ['/home/pi/app.mjs', 'javascript', 'JavaScript'],
    ['lib.cjs', 'javascript', 'JavaScript'],
    ['package.json', 'json', 'JSON'],
    ['index.html', 'html', 'HTML'],
    ['page.HTM', 'html', 'HTML'],
    ['styles.css', 'css', 'CSS'],
    ['README.md', 'markdown', 'Markdown'],
    ['setup.sh', 'shell', 'Shell'],
    ['notes.txt', 'plaintext', 'Plain Text'],
  ] as const)(
    'maps %s to %s / %s',
    (path, monacoLanguage, label) => {
      expect(resolveEditorLanguage(path)).toEqual({ monacoLanguage, label });
    },
  );

  it('falls back to Plain Text for unknown extensions', () => {
    expect(resolveEditorLanguage('/home/pi/data.bin')).toEqual({
      monacoLanguage: 'plaintext',
      label: 'Plain Text',
    });
  });

  it('falls back to Plain Text when path is empty or has no extension', () => {
    expect(resolveEditorLanguage(null)).toEqual({
      monacoLanguage: 'plaintext',
      label: 'Plain Text',
    });
    expect(resolveEditorLanguage(undefined)).toEqual({
      monacoLanguage: 'plaintext',
      label: 'Plain Text',
    });
    expect(resolveEditorLanguage('Makefile')).toEqual({
      monacoLanguage: 'plaintext',
      label: 'Plain Text',
    });
    expect(resolveEditorLanguage('.gitignore')).toEqual({
      monacoLanguage: 'plaintext',
      label: 'Plain Text',
    });
  });
});
