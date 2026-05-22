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

export function isSetupReady(): boolean {
  // TODO: セットアップ完了状態の確認ロジックを実装する。
  return false;
}
