export type ConnectivityCheckResult = 'ok' | 'ng';

const OK_PATTERNS: RegExp[] = [/\b200\s+OK\b/i, /remote file exists/i];

/**
 * wget --spider の stdout から疎通結果を判定する。
 */
export function parseConnectivityCheckResult(
  stdout: string,
): ConnectivityCheckResult {
  if (OK_PATTERNS.some((pattern) => pattern.test(stdout))) {
    return 'ok';
  }
  return 'ng';
}
