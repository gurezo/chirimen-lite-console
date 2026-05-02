/// <reference types="@types/w3c-web-serial" />

/**
 * Issue #606: ポート検証。`SerialSession.getPortInfo()`（`@gurezo/web-serial-rxjs` v2.3.1）と一致する USB ID 判定。
 */
import { Injectable } from '@angular/core';
import { RASPBERRY_PI_ZERO_INFO } from '@libs-web-serial-util';

/**
 * Serial デバイス検証サービス
 * 接続されたデバイスの検証を担当
 */
@Injectable({
  providedIn: 'root',
})
export class SerialValidatorService {
  /**
   * 同期 `SerialPortInfo`（`SerialSession.getPortInfo()` 等）で Pi Zero 互換 USB ID か判定
   */
  isPiZeroPortInfo(info: SerialPortInfo | null | undefined): boolean {
    if (info == null) {
      return false;
    }
    const { usbVendorId, usbProductId } = info;
    if (usbVendorId == null || usbProductId == null) {
      return false;
    }
    return (
      usbVendorId === RASPBERRY_PI_ZERO_INFO.usbVendorId &&
      usbProductId === RASPBERRY_PI_ZERO_INFO.usbProductId
    );
  }

  /**
   * 同期 `portInfo` または `SerialPort#getInfo()` で Pi Zero 相当か判定する。
   * {@link SerialTransportService} 等、ポート取得 API を持つオブジェクト向け。
   */
  async isRaspberryPiZeroSerialAccess(access: {
    getPortInfo(): SerialPortInfo | null;
    getPort(): SerialPort | undefined;
  }): Promise<boolean> {
    if (this.isPiZeroPortInfo(access.getPortInfo())) {
      return true;
    }
    const port = access.getPort();
    if (!port) {
      return false;
    }
    try {
      const info = await port.getInfo();
      return this.isPiZeroPortInfo(info);
    } catch (error) {
      console.error('Failed to get port info:', error);
      return false;
    }
  }
}
