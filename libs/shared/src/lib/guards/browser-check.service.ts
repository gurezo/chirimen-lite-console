import { Injectable } from '@angular/core';
import { createSerialSession } from '@gurezo/web-serial-rxjs';

@Injectable({ providedIn: 'root' })
export class BrowserCheckService {
  /**
   * Web Serial 利用可否（Chromium 系・API 有無を @gurezo/web-serial-rxjs で検証）
   * v2: セッションの isBrowserSupported（createSerialSession）
   */
  isSupported(): boolean {
    const session = createSerialSession();
    return session.isBrowserSupported();
  }
}
