/// <reference types="@types/w3c-web-serial" />

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
   * Raspberry Pi Zero かどうかを検証
   * @param port SerialPort
   * @returns Raspberry Pi Zero の場合 true
   */
  async isRaspberryPiZero(port: SerialPort): Promise<boolean> {
    try {
      const info = await port.getInfo();
      return this.isPiZeroPortInfo(info);
    } catch (error) {
      console.error('Failed to get port info:', error);
      return false;
    }
  }

  /**
   * デバイス情報を取得
   * @param port SerialPort
   * @returns デバイス情報
   */
  async getDeviceInfo(
    port: SerialPort
  ): Promise<{ vendorId?: number; productId?: number } | null> {
    try {
      const info = await port.getInfo();
      return {
        vendorId: info.usbVendorId,
        productId: info.usbProductId,
      };
    } catch (error) {
      console.error('Failed to get device info:', error);
      return null;
    }
  }

  /**
   * サポートされているデバイスかどうかを検証
   * 現在は Raspberry Pi Zero のみサポート
   * @param port SerialPort
   * @returns サポートされている場合 true
   */
  async isSupportedDevice(port: SerialPort): Promise<boolean> {
    return await this.isRaspberryPiZero(port);
  }
}
