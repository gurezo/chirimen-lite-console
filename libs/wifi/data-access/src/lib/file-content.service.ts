import { Injectable, inject } from '@angular/core';
import { SerialFacadeService } from '@libs-web-serial-data-access';
import { FileUtils } from '@libs-wifi-util';
import {
  PI_ZERO_PROMPT,
  SERIAL_TIMEOUT,
  wrapSerialError,
} from '@libs-web-serial-util';
import { firstValueFrom } from 'rxjs';

/**
 * ファイル内容情報
 */
export interface FileContentInfo {
  content: string | ArrayBuffer;
  isText: boolean;
  size: number;
  encoding?: string;
}

/**
 * ファイルコンテンツサービス
 *
 * ファイルの読み書きを担当（WiFi 設定等で利用）
 */
@Injectable({
  providedIn: 'root',
})
export class FileContentService {
  private serial = inject(SerialFacadeService);

  async readFile(path: string): Promise<FileContentInfo> {
    try {
      const result = (
        await firstValueFrom(this.serial.exec$(`base64 -- ${FileUtils.escapePath(path)}`, {
          prompt: PI_ZERO_PROMPT,
          timeout: SERIAL_TIMEOUT.LONG,
        }))
      ).stdout;

      const lines = result.split('\n').map((line) => line.trim());
      let content = '';

      for (let i = 1; i < lines.length - 1; i++) {
        content += lines[i];
      }

      const buffer = FileUtils.base64ToArrayBuffer(content);
      const isText = FileUtils.isTextFile(path);

      if (isText) {
        const textContent = new TextDecoder().decode(new Uint8Array(buffer));
        return {
          content: textContent,
          isText: true,
          size: textContent.length,
          encoding: 'utf-8',
        };
      } else {
        return {
          content: buffer,
          isText: false,
          size: buffer.byteLength,
        };
      }
    } catch (error: unknown) {
      throw wrapSerialError('Failed to read file', error);
    }
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    try {
      const command = FileUtils.generateHeredocCommand(path, content);
      await firstValueFrom(this.serial.exec$(command, {
        prompt: 'EOL',
        timeout: SERIAL_TIMEOUT.DEFAULT,
      }));
    } catch (error: unknown) {
      throw wrapSerialError('Failed to write text file', error);
    }
  }

  async writeBinaryFile(path: string, buffer: ArrayBuffer): Promise<void> {
    try {
      const base64 = FileUtils.arrayBufferToBase64(buffer);

      await firstValueFrom(this.serial.send$('\x03'));
      await this.sleep(100);

      await firstValueFrom(this.serial.exec$(`base64 -d > ${FileUtils.escapePath(path)}`, {
        prompt: '\n',
        timeout: SERIAL_TIMEOUT.DEFAULT,
      }));

      const lineLength = 512;
      for (let i = 0; i <= Math.floor(base64.length / lineLength); i++) {
        const line = base64.substring(i * lineLength, (i + 1) * lineLength);
        await firstValueFrom(this.serial.exec$(line, {
          prompt: '\n',
          timeout: SERIAL_TIMEOUT.LINE,
        }));
        await this.sleep(1);
      }

      await firstValueFrom(this.serial.send$('\x04'));
      await this.sleep(10);
      await firstValueFrom(this.serial.exec$('', {
        prompt: '\\$',
        timeout: SERIAL_TIMEOUT.LINE,
      }));
    } catch (error: unknown) {
      throw wrapSerialError('Failed to write binary file', error);
    }
  }

  async appendToFile(path: string, content: string): Promise<void> {
    try {
      const command = FileUtils.generateAppendCommand(path, content);
      await firstValueFrom(this.serial.exec$(command, {
        prompt: 'EOL',
        timeout: SERIAL_TIMEOUT.DEFAULT,
      }));
    } catch (error: unknown) {
      throw wrapSerialError('Failed to append to file', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
