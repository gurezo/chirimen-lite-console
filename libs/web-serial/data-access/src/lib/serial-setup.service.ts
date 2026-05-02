import { Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import type { PiZeroBootstrapStatusHandler } from './pi-zero-serial-bootstrap.service';
import { PiZeroSerialBootstrapService } from './pi-zero-serial-bootstrap.service';

export interface SerialSetupResult {
  initialized: true;
}

/**
 * 接続後初期化の単一入口。
 * login / shell ready / environment setup を順番に実行し、失敗時はエラーを伝播する。
 */
@Injectable({
  providedIn: 'root',
})
export class SerialSetupService {
  constructor(private readonly bootstrap: PiZeroSerialBootstrapService) {}

  loginIfNeeded$(onStatus?: PiZeroBootstrapStatusHandler): Observable<void> {
    return this.bootstrap.loginIfNeeded$(onStatus);
  }

  setupEnvironment$(onStatus?: PiZeroBootstrapStatusHandler): Observable<void> {
    return this.bootstrap.setupEnvironment$(onStatus);
  }

  setupAfterConnect$(
    onStatus?: PiZeroBootstrapStatusHandler,
  ): Observable<SerialSetupResult> {
    return this.bootstrap
      .runPostConnectPipeline$(onStatus)
      .pipe(map(() => ({ initialized: true as const })));
  }
}
