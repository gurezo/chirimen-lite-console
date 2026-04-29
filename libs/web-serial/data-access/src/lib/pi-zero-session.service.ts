import { Injectable } from '@angular/core';
import { PiZeroSerialBootstrapService } from './pi-zero-serial-bootstrap.service';
import { PiZeroShellReadinessService } from './pi-zero-shell-readiness.service';

/**
 * Pi Zero / CHIRIMEN 固有のシリアルセッション境界（issue #557）。
 *
 * UI や feature 層は、汎用の送受信に {@link SerialFacadeService}、接続後のログイン・初期化に
 * {@link PiZeroSerialBootstrapService}、シェル準備フラグに {@link PiZeroShellReadinessService} を利用する。
 * 本サービスはそれらへの単一エントリとして DI を整理する。
 */
@Injectable({
  providedIn: 'root',
})
export class PiZeroSessionService {
  constructor(
    readonly bootstrap: PiZeroSerialBootstrapService,
    readonly shellReadiness: PiZeroShellReadinessService,
  ) {}
}
