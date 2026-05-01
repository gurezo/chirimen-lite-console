export const RASPBERRY_PI_ZERO_INFO = {
  usbVendorId: 0x0525,
  usbProductId: 0xa4a7,
} as const;

/**
 * Raspberry Pi OS シリアルコンソールのデフォルト認証（Issue #498）
 */
export const PI_ZERO_LOGIN_USER = 'pi' as const;
export const PI_ZERO_LOGIN_PASSWORD = 'raspberry' as const;
export const PI_ZERO_LOGIN_USER_STORAGE_KEY =
  'chirimenLiteConsole.piZeroLoginUser' as const;
export const PI_ZERO_LOGIN_PASSWORD_STORAGE_KEY =
  'chirimenLiteConsole.piZeroLoginPassword' as const;

export interface PiZeroLoginCredential {
  user: string;
  password: string;
}

/**
 * ブラウザ localStorage から Pi Zero ログイン認証情報を取得する。
 * 未設定／取得不可時はデフォルト値を返す。
 */
export function resolvePiZeroLoginCredential(): PiZeroLoginCredential {
  const fallback: PiZeroLoginCredential = {
    user: PI_ZERO_LOGIN_USER,
    password: PI_ZERO_LOGIN_PASSWORD,
  };
  const storage =
    typeof globalThis !== 'undefined' ? globalThis.localStorage : undefined;
  if (!storage) {
    return fallback;
  }
  try {
    const user =
      storage.getItem(PI_ZERO_LOGIN_USER_STORAGE_KEY)?.trim() || fallback.user;
    const password =
      storage.getItem(PI_ZERO_LOGIN_PASSWORD_STORAGE_KEY)?.trim() ||
      fallback.password;
    return { user, password };
  } catch {
    return fallback;
  }
}

export const PI_ZERO_PROMPT = 'pi@raspberrypi:' as const;
