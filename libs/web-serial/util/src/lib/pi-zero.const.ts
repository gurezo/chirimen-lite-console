export const RASPBERRY_PI_ZERO_INFO = {
  usbVendorId: 0x0525,
  usbProductId: 0xa4a7,
} as const;

/**
 * Raspberry Pi OS シリアルコンソールのデフォルト認証（Issue #498）
 */
export const PI_ZERO_LOGIN_USER = 'pi' as const;
export const PI_ZERO_LOGIN_PASSWORD = 'raspberry' as const;

export const PI_ZERO_PROMPT = 'pi@raspberrypi:' as const;
