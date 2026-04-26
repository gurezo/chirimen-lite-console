export const RASPBERRY_PI_ZERO_INFO = {
  usbVendorId: 0x0525,
  usbProductId: 0xa4a7,
} as const;

/**
 * Raspberry Pi OS シリアルコンソールのデフォルト認証（Issue #498）
 */
export const PI_ZERO_LOGIN_USER = 'pi' as const;
export const PI_ZERO_LOGIN_PASSWORD = 'raspberry' as const;

/**
 * ログイン名入力待ち。
 * - 英語 `login:` / 日本語ロケールの `ログイン:` 等（大小・`:` 前の空白差を吸収）
 * - 行末 `$` に依存しない（シリアルに ANSI や未改行が混ざっても検出しやすくする）
 */
export const PI_ZERO_SERIAL_LOGIN_LINE_PATTERN =
  /(?:^|[\r\n])[^\r\n]*(?:[Ll]ogin|ログイン)\s*:\s*/im;

/**
 * パスワード入力待ち（`Password:` / `password:` 行末）
 */
export const PI_ZERO_SERIAL_PASSWORD_LINE_PATTERN =
  /[^\r\n]*[Pp]assword:\s*$/im;

export const PI_ZERO_PROMPT = 'pi@raspberrypi:' as const;

/**
 * シリアルコンソールの pi ユーザーシェルプロンプト先頭（`pi@<hostname>:`）。
 * 固定文字列 {@link PI_ZERO_PROMPT} だけでは Chirimen 等でホスト名が異なりログイン完了を検出できない。
 */
export const PI_ZERO_SHELL_PROMPT_LINE_PATTERN = /pi@[^:\r\n]+:/;
