export type EditorLanguageInfo = {
  monacoLanguage: string;
  label: string;
};

const EXTENSION_LANGUAGE_MAP: Record<string, EditorLanguageInfo> = {
  '.js': { monacoLanguage: 'javascript', label: 'JavaScript' },
  '.mjs': { monacoLanguage: 'javascript', label: 'JavaScript' },
  '.cjs': { monacoLanguage: 'javascript', label: 'JavaScript' },
  '.json': { monacoLanguage: 'json', label: 'JSON' },
  '.html': { monacoLanguage: 'html', label: 'HTML' },
  '.htm': { monacoLanguage: 'html', label: 'HTML' },
  '.css': { monacoLanguage: 'css', label: 'CSS' },
  '.md': { monacoLanguage: 'markdown', label: 'Markdown' },
  '.sh': { monacoLanguage: 'shell', label: 'Shell' },
  '.txt': { monacoLanguage: 'plaintext', label: 'Plain Text' },
};

const PLAIN_TEXT: EditorLanguageInfo = {
  monacoLanguage: 'plaintext',
  label: 'Plain Text',
};

function getExtension(pathOrFileName: string): string {
  const base =
    pathOrFileName.lastIndexOf('/') >= 0
      ? pathOrFileName.slice(pathOrFileName.lastIndexOf('/') + 1)
      : pathOrFileName;
  const lastDot = base.lastIndexOf('.');
  if (lastDot <= 0) {
    return '';
  }
  return base.slice(lastDot).toLowerCase();
}

/**
 * Resolve Monaco language id and display label from a file path or name.
 * Unknown extensions fall back to Plain Text.
 */
export function resolveEditorLanguage(
  pathOrFileName: string | null | undefined,
): EditorLanguageInfo {
  if (!pathOrFileName) {
    return PLAIN_TEXT;
  }
  const extension = getExtension(pathOrFileName);
  if (!extension) {
    return PLAIN_TEXT;
  }
  return EXTENSION_LANGUAGE_MAP[extension] ?? PLAIN_TEXT;
}
