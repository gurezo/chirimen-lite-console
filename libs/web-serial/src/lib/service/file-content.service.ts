import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PI_ZERO_PROMPT } from '../constants/pi-zero.const';
import { classifyFileWriteError } from '../functions/classify-file-write-error';
import { createPiZeroShellExecOptions } from '../functions/pi-zero-shell-exec-options';
import { FileUtils } from '../functions/file.utils';
import { SERIAL_TIMEOUT } from '../functions/serial-timeout';
import { wrapSerialError } from '../functions/serial-error-wrap';
import type { FileContentInfo } from '../models/file-content.types';
import { PiZeroPromptDetectorService } from './pi-zero-prompt-detector.service';
import { SerialFacadeService } from './serial-facade.service';

/**
 * ファイルコンテンツサービス
 *
 * シリアル経由でファイルの読み書きを担当
 */
@Injectable({
  providedIn: 'root',
})
export class FileContentService {
  private serial = inject(SerialFacadeService);
  private promptDetector = inject(PiZeroPromptDetectorService);

  private shellExecOptions(timeout: number = SERIAL_TIMEOUT.DEFAULT) {
    return createPiZeroShellExecOptions(this.promptDetector, { timeout });
  }

  async readFile(path: string): Promise<FileContentInfo> {
    try {
      const result = (
        await firstValueFrom(
          this.serial.exec$(`base64 -- ${FileUtils.escapePath(path)}`, {
            prompt: PI_ZERO_PROMPT,
            timeout: SERIAL_TIMEOUT.LONG,
          }),
        )
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

  /**
   * テキストファイルを一時ファイル経由で安全に保存する。
   *
   * 1. 一時ファイルへ書込
   * 2. サイズ検証
   * 3. `mv` で対象へ置換（置換成功まで元ファイルは非接触）
   * 4. 保存後検証
   * 失敗時は一時ファイルをベストエフォートで削除する。
   */
  async writeTextFile(path: string, content: string): Promise<void> {
    if (!this.serial.isConnected()) {
      throw classifyFileWriteError(new Error('not connected'));
    }

    const expectedBytes = FileUtils.utf8ByteLength(content);
    const tempPath = FileUtils.buildTempSavePath(path);
    let replaced = false;

    try {
      await this.writeTextPayload(tempPath, content, expectedBytes);
      await this.assertRemoteByteSize(tempPath, expectedBytes);

      await firstValueFrom(
        this.serial.exec$(
          `mv -- ${FileUtils.escapePath(tempPath)} ${FileUtils.escapePath(path)}`,
          this.shellExecOptions(SERIAL_TIMEOUT.FILE_TRANSFER),
        ),
      );
      replaced = true;

      await this.verifySavedTextFile(path, content, expectedBytes);
    } catch (error: unknown) {
      if (!replaced) {
        await this.cleanupTempFile(tempPath);
      }
      throw classifyFileWriteError(error);
    }
  }

  async writeBinaryFile(path: string, buffer: ArrayBuffer): Promise<void> {
    try {
      const base64 = FileUtils.arrayBufferToBase64(buffer);

      await firstValueFrom(this.serial.send$('\x03'));
      await this.sleep(100);

      await firstValueFrom(
        this.serial.exec$(`base64 -d > ${FileUtils.escapePath(path)}`, {
          prompt: '\n',
          timeout: SERIAL_TIMEOUT.DEFAULT,
        }),
      );

      const lineLength = 512;
      for (let i = 0; i <= Math.floor(base64.length / lineLength); i++) {
        const line = base64.substring(i * lineLength, (i + 1) * lineLength);
        await firstValueFrom(
          this.serial.exec$(line, {
            prompt: '\n',
            timeout: SERIAL_TIMEOUT.LINE,
          }),
        );
        await this.sleep(1);
      }

      await firstValueFrom(this.serial.send$('\x04'));
      await this.sleep(10);
      await firstValueFrom(
        this.serial.exec$('', {
          prompt: '\\$',
          timeout: SERIAL_TIMEOUT.LINE,
        }),
      );
    } catch (error: unknown) {
      throw wrapSerialError('Failed to write binary file', error);
    }
  }

  async appendToFile(path: string, content: string): Promise<void> {
    try {
      const command = FileUtils.generateAppendCommand(path, content);
      await firstValueFrom(
        this.serial.exec$(command, {
          prompt: PI_ZERO_PROMPT,
          timeout: SERIAL_TIMEOUT.DEFAULT,
        }),
      );
    } catch (error: unknown) {
      throw wrapSerialError('Failed to append to file', error);
    }
  }

  private async writeTextPayload(
    path: string,
    content: string,
    expectedBytes: number,
  ): Promise<void> {
    if (expectedBytes > FileUtils.TEXT_CHUNK_THRESHOLD_BYTES) {
      const buffer = new TextEncoder().encode(content).buffer;
      await this.writeBinaryFile(path, buffer);
      return;
    }

    const command = FileUtils.generateHeredocCommand(path, content);
    await firstValueFrom(
      this.serial.exec$(
        command,
        this.shellExecOptions(SERIAL_TIMEOUT.FILE_TRANSFER),
      ),
    );
  }

  private async assertRemoteByteSize(
    path: string,
    expectedBytes: number,
  ): Promise<void> {
    const stdout = (
      await firstValueFrom(
        this.serial.exec$(
          FileUtils.generateByteSizeCommand(path),
          this.shellExecOptions(SERIAL_TIMEOUT.FILE_TRANSFER),
        ),
      )
    ).stdout;

    const actual = FileUtils.parseByteSizeOutput(stdout);
    if (actual === null) {
      throw new Error(
        `size mismatch: could not parse byte size for ${path}`,
      );
    }
    if (actual !== expectedBytes) {
      throw new Error(
        `size mismatch: expected ${expectedBytes} bytes but got ${actual}`,
      );
    }
  }

  private async verifySavedTextFile(
    path: string,
    content: string,
    expectedBytes: number,
  ): Promise<void> {
    if (expectedBytes > FileUtils.TEXT_CHUNK_THRESHOLD_BYTES) {
      await this.assertRemoteByteSize(path, expectedBytes);
      return;
    }

    const info = await this.readFile(path);
    if (!info.isText || typeof info.content !== 'string') {
      throw new Error('content mismatch: saved file is not text');
    }
    if (info.content !== content) {
      throw new Error('content mismatch: saved file differs from editor content');
    }
  }

  private async cleanupTempFile(tempPath: string): Promise<void> {
    try {
      await firstValueFrom(
        this.serial.exec$(
          `rm -f -- ${FileUtils.escapePath(tempPath)}`,
          this.shellExecOptions(SERIAL_TIMEOUT.DEFAULT),
        ),
      );
    } catch {
      // best-effort cleanup
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
