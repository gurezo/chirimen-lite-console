/** Full rewrite (#606). Shell readiness flag for post-bootstrap consumers. */
import { Injectable } from '@angular/core';
import { BehaviorSubject, type Observable } from 'rxjs';

/**
 * Pi Zero シリアル接続後のシェル到達（ログイン完了）を共有する。
 * ファイルツリーなど、シェルプロンプト到達後にシリアル exec すべき箇所が購読する。
 * 環境初期化コマンドはバックグラウンドで継続し得る（issue #717）。
 */
@Injectable({
  providedIn: 'root',
})
export class PiZeroShellReadinessService {
  private readonly readySubject = new BehaviorSubject(false);

  readonly ready$: Observable<boolean> = this.readySubject.asObservable();

  setReady(value: boolean): void {
    this.readySubject.next(value);
  }

  reset(): void {
    this.readySubject.next(false);
  }

  isReady(): boolean {
    return this.readySubject.value;
  }
}
