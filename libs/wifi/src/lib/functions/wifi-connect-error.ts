export type WifiConnectErrorKind = 'auth' | 'command';

export class WifiConnectError extends Error {
  readonly kind: WifiConnectErrorKind;

  constructor(kind: WifiConnectErrorKind, message: string) {
    super(message);
    this.name = 'WifiConnectError';
    this.kind = kind;
  }
}

const AUTH_PATTERNS: RegExp[] = [
  /secrets were required/i,
  /802-11-wireless-security/i,
  /wrong password/i,
  /authentication\s*(failed|error|reject)/i,
  /invalid.*(?:password|psk)/i,
  /psk.*(?:reject|fail)/i,
  /(?:password|psk).*(?:incorrect|invalid|fail)/i,
  /association timed? ?out/i,
];

const FAILURE_MARKERS: RegExp[] = [
  /WIFI_CONNECT_FAILED/i,
  /\bError:/i,
  /Connection activation failed/i,
];

export function classifyWifiConnectFailure(raw: string): WifiConnectErrorKind {
  if (AUTH_PATTERNS.some((pattern) => pattern.test(raw))) {
    return 'auth';
  }
  return 'command';
}

export function isWifiConnectFailureOutput(raw: string): boolean {
  return FAILURE_MARKERS.some((pattern) => pattern.test(raw));
}

export function messageForWifiConnectKind(kind: WifiConnectErrorKind): string {
  if (kind === 'auth') {
    return '認証に失敗しました。パスワードを確認してください';
  }
  return '接続コマンドの実行に失敗しました';
}

/**
 * シリアル出力から接続失敗を検出する。失敗でなければ null。
 * ユーザー向け文言に SSID / Password を含めない。
 */
export function wifiConnectErrorFromOutput(
  output: string,
): WifiConnectError | null {
  if (!output.trim() || !isWifiConnectFailureOutput(output)) {
    return null;
  }
  const kind = classifyWifiConnectFailure(output);
  return new WifiConnectError(kind, messageForWifiConnectKind(kind));
}

/**
 * catch した unknown を WifiConnectError に正規化する。
 */
export function toWifiConnectError(error: unknown): WifiConnectError {
  if (error instanceof WifiConnectError) {
    return error;
  }
  const raw = error instanceof Error ? error.message : String(error);
  const kind = classifyWifiConnectFailure(raw);
  return new WifiConnectError(kind, messageForWifiConnectKind(kind));
}
