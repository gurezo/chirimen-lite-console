import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { BrowserCheckService } from './browser-check.service';

export const browserCheckGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const browserCheck = inject(BrowserCheckService);
  const supported = browserCheck.isSupported();
  const path = route.routeConfig?.path;

  // unsupported-browser ページへのアクセス時
  if (path === 'unsupported-browser') {
    // 対応ブラウザならホームへリダイレクト
    if (supported) {
      return router.parseUrl('/');
    }

    // 非対応ブラウザならそのまま表示
    return true;
  }

  // 上記以外（ルート '' など）へのアクセス時
  if (supported) {
    // 対応ブラウザならそのまま表示
    return true;
  }

  // 非対応ブラウザならサポート外ページへリダイレクト
  return router.parseUrl('/unsupported-browser');
};
