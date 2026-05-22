/** Full rewrite (#606). Shell readiness flag for post-bootstrap consumers. */
import { Injectable } from '@angular/core';
import { BehaviorSubject, type Observable } from 'rxjs';

/**
 * Pi Zero シリアル接続後のブートストラップ（ログイン・タイムゾーン等）完了を共有する。
 * ファイルツリーなど、シェルプロンプト到達後にのみシリアル exec すべき箇所が購読する。
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
