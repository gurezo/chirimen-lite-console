import { Injectable, inject } from '@angular/core';
import { FileContentService } from '@libs-wifi-data-access';
import { SerialFacadeService } from '@libs-web-serial';
import { FileUtils } from '@libs-wifi-util';
import { PI_ZERO_PROMPT, SERIAL_TIMEOUT } from '@libs-web-serial';
import { parseLsOutput } from '../functions/file-tree.util';
import { FileTreeNode } from '../models/file-tree.model';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FileService {
  private serial = inject(SerialFacadeService);
  private fileContent = inject(FileContentService);

  /**
   * ディレクトリ直下の ls 出力（行単位）を返します。
   */
  async listLines(directoryPath: string): Promise<string[]> {
    const dir = directoryPath || '.';
    const escaped = FileUtils.escapePath(dir);

    const stdout = (
      await firstValueFrom(this.serial.exec$(`ls -al --quoting-style=c -- ${escaped}`, {
        prompt: PI_ZERO_PROMPT,
        timeout: SERIAL_TIMEOUT.LONG,
      }))
    ).stdout;

    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  /**
   * ディレクトリ直下をツリー表示向けに整形して返します。
   */
  async listTree(path: string): Promise<FileTreeNode[]> {
    const lines = await this.listLines(path);
    return parseLsOutput(lines, path);
  }

  async mkdir(path: string): Promise<void> {
    const escaped = FileUtils.escapePath(path);
    await firstValueFrom(this.serial.exec$(`mkdir -p -- ${escaped}`, {
      prompt: PI_ZERO_PROMPT,
      timeout: SERIAL_TIMEOUT.DEFAULT,
    }));
  }

  async touch(path: string): Promise<void> {
    const escaped = FileUtils.escapePath(path);
    await firstValueFrom(this.serial.exec$(`touch -- ${escaped}`, {
      prompt: PI_ZERO_PROMPT,
      timeout: SERIAL_TIMEOUT.DEFAULT,
    }));
  }

  async remove(path: string): Promise<void> {
    const escaped = FileUtils.escapePath(path);
    await firstValueFrom(this.serial.exec$(`rm -- ${escaped}`, {
      prompt: PI_ZERO_PROMPT,
      timeout: SERIAL_TIMEOUT.DEFAULT,
    }));
  }

  async read(path: string): Promise<string> {
    const info = await this.fileContent.readFile(path);
    if (!info.isText || typeof info.content !== 'string') {
      throw new Error('Target file is not a text file');
    }
    return info.content;
  }

  async move(fromPath: string, toPath: string): Promise<void> {
    const fromEscaped = FileUtils.escapePath(fromPath);
    const toEscaped = FileUtils.escapePath(toPath);
    await firstValueFrom(this.serial.exec$(`mv -- ${fromEscaped} ${toEscaped}`, {
      prompt: PI_ZERO_PROMPT,
      timeout: SERIAL_TIMEOUT.DEFAULT,
    }));
  }

  /**
   * バイナリのアップロード（base64 + Ctrl-C/Ctrl-D 方式）
   */
  async writeBinary(targetPath: string, buffer: ArrayBuffer): Promise<void> {
    await this.fileContent.writeBinaryFile(targetPath, buffer);
  }
}
