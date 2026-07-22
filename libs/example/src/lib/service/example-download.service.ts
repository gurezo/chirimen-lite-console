import { Injectable, inject } from '@angular/core';
import {
  FileUtils,
  PI_ZERO_PROMPT,
  SERIAL_TIMEOUT,
  SerialFacadeService,
} from '@libs-web-serial';
import { firstValueFrom } from 'rxjs';
import {
  buildExampleDownloadFileName,
  buildExampleMainJsUrl,
} from '../functions';

@Injectable({
  providedIn: 'root',
})
export class ExampleDownloadService {
  private serial = inject(SerialFacadeService);

  /**
   * Downloads example main.js onto the device shell cwd via wget
   * (same session as the interactive terminal).
   *
   * @returns Saved relative file name (e.g. `main-hello-real-world.js`)
   */
  async downloadToShellCwd(exampleId: string): Promise<string> {
    if (!this.serial.isConnected()) {
      throw new Error('Serial port is not connected');
    }

    const fileName = buildExampleDownloadFileName(exampleId);
    const url = buildExampleMainJsUrl(exampleId);
    const escapedFileName = FileUtils.escapePath(fileName);

    await firstValueFrom(
      this.serial.exec$(`wget -O ${escapedFileName} ${url}`, {
        prompt: PI_ZERO_PROMPT,
        timeout: SERIAL_TIMEOUT.FILE_TRANSFER,
      }),
    );

    return fileName;
  }
}
