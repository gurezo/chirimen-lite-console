import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {
      void 0;
    }
    unobserve(): void {
      void 0;
    }
    disconnect(): void {
      void 0;
    }
  };
}

setupTestBed({ zoneless: false });
