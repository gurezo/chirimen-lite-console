import { DEFAULT_PROJECT_SUBDIR } from '../constants';

export function isValidNodeTarUrl(url: string): boolean {
  const t = url.trim();
  if (!t) {
    return false;
  }
  try {
    const u = new URL(t);
    return u.protocol === 'https:' && u.hostname === 'unofficial-builds.nodejs.org';
  } catch {
    return false;
  }
}

/**
 * 英数字・ハイフン・アンダースコアのみ許可（パスインジェクション防止）
 */
export function sanitizeProjectSubdir(name: string): string {
  const s = name.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  return s.length > 0 ? s : DEFAULT_PROJECT_SUBDIR;
}

/**
 * `node -v` / `npm -v` の標準出力からセットアップ完了を判定する。
 */
export function isSetupReady(stdoutNode: string, stdoutNpm: string): boolean {
  const nodeLine = firstMeaningfulLine(stdoutNode);
  const npmLine = firstMeaningfulLine(stdoutNpm);
  if (!nodeLine || !npmLine) {
    return false;
  }
  if (looksLikeBashMissing(nodeLine) || looksLikeBashMissing(npmLine)) {
    return false;
  }
  const nodeOk = /^v?\d+\.\d+/.test(nodeLine);
  const npmOk = /^\d+\.\d+/.test(npmLine);
  return nodeOk && npmOk;
}

function firstMeaningfulLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? ''
  );
}

function looksLikeBashMissing(line: string): boolean {
  return line.startsWith('-bash:') || line.includes('command not found');
}
