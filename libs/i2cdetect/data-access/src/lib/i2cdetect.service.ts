import { Injectable, inject } from '@angular/core';
import {
  type Observable,
  catchError,
  firstValueFrom,
  map,
  throwError,
} from 'rxjs';
import { SerialFacadeService } from '@libs-web-serial';
import { formatI2cdetectResult } from '@libs-i2cdetect-util';
import {
  PI_ZERO_PROMPT,
  SERIAL_TIMEOUT,
  wrapSerialError,
} from '@libs-web-serial';

/**
 * I2C デバイス検出サービス
 *
 * I2C デバイスの検出と情報取得を担当
 * ChirimenService から分離
 */
@Injectable({
  providedIn: 'root',
})
export class I2cdetectService {
  private serial = inject(SerialFacadeService);

  /**
   * I2C デバイスを検出（Observable）
   *
   * @returns I2C デバイス情報（HTML形式）
   */
  detectI2cDevices$(): Observable<string> {
    return this.serial.exec$('i2cdetect -y 1', {
      prompt: PI_ZERO_PROMPT,
      timeout: SERIAL_TIMEOUT.DEFAULT,
    }).pipe(
      map((result) => formatI2cdetectResult(result.stdout)),
      catchError((error: unknown) =>
        throwError(() =>
          wrapSerialError('Failed to detect I2C devices', error),
        ),
      ),
    );
  }

  /**
   * I2C デバイスを検出
   *
   * @returns I2C デバイス情報（HTML形式）
   */
  async detectI2cDevices(): Promise<string> {
    return firstValueFrom(this.detectI2cDevices$());
  }

  /**
   * @deprecated Use detectI2cDevices() instead
   */
  async i2cdetect(): Promise<string> {
    return this.detectI2cDevices();
  }
}
