import { Injectable, inject } from '@angular/core';
import { FileContentService, FileUtils } from '@libs-wifi';
import {
  createPiZeroShellExecOptions,
  PiZeroPromptDetectorService,
  sanitizeSerialStdout,
  SERIAL_TIMEOUT,
  SerialFacadeService,
} from '@libs-web-serial';
import { parseLsOutput } from '../functions';
import { FileTreeNode } from '../models';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FileService {
  private serial = inject(SerialFacadeService);
  private fileContent = inject(FileContentService);
  private promptDetector = inject(PiZeroPromptDetectorService);

  private shellExecOptions(timeout: number = SERIAL_TIMEOUT.DEFAULT) {
    return createPiZeroShellExecOptions(this.promptDetector, { timeout });
  }

  /**
   * ディレクトリ直下の ls 出力（行単位）を返します。
   */
  async listLines(directoryPath: string): Promise<string[]> {
    const dir = directoryPath || '.';
    const escaped = FileUtils.escapePath(dir);
    const command = `ls -al --quoting-style=c -- ${escaped}`;

    const stdout = (
      await firstValueFrom(
        this.serial.exec$(
          command,
          this.shellExecOptions(SERIAL_TIMEOUT.LONG),
        ),
      )
    ).stdout;

    const cleaned = sanitizeSerialStdout(
      typeof stdout === 'string' ? stdout : '',
      command,
      '',
    );

    return cleaned
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !this.promptDetector.isCommandCompleted(line));
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
    await firstValueFrom(
      this.serial.exec$(`mkdir -p -- ${escaped}`, this.shellExecOptions()),
    );
  }

  async touch(path: string): Promise<void> {
    const escaped = FileUtils.escapePath(path);
    await firstValueFrom(
      this.serial.exec$(`touch -- ${escaped}`, this.shellExecOptions()),
    );
  }

  async remove(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<void> {
    const escaped = FileUtils.escapePath(path);
    const command = options?.recursive
      ? `rm -r -- ${escaped}`
      : `rm -- ${escaped}`;
    await firstValueFrom(
      this.serial.exec$(command, this.shellExecOptions()),
    );
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
    await firstValueFrom(
      this.serial.exec$(
        `mv -- ${fromEscaped} ${toEscaped}`,
        this.shellExecOptions(),
      ),
    );
  }

  /**
   * バイナリのアップロード（base64 + Ctrl-C/Ctrl-D 方式）
   */
  async writeBinary(targetPath: string, buffer: ArrayBuffer): Promise<void> {
    await this.fileContent.writeBinaryFile(targetPath, buffer);
  }
}
