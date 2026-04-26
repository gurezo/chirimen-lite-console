import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SerialFacadeService } from '@libs-web-serial-data-access';
import { map, take } from 'rxjs';

/**
 * 接続必須でないルート（'' または 'unsupported-browser'）は常に許可する。
 * それ以外のルートでは、接続済みなら許可、未接続なら '/' へリダイレクトする。
 * 接続状態は `@gurezo/web-serial-rxjs` をラップする {@link SerialFacadeService#isConnected$} のみを参照。
 */
export const connectionGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const serial = inject(SerialFacadeService);

  const path = route.routeConfig?.path;
  const isPublicPath =
    path === '' || path === 'unsupported-browser';

  if (isPublicPath) {
    return true;
  }

  return serial.isConnected$.pipe(
    take(1),
    map((connected) =>
      connected ? true : router.parseUrl('/')
    )
  );
};
