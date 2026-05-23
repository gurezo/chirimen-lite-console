import { Routes } from '@angular/router';
import { browserCheckGuard } from '@libs-shared';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('@libs-console-shell').then((m) => m.consoleShellRoutes),
  },
  {
    path: 'unsupported-browser',
    loadComponent: () => import('@libs-unsupported-browser'),
    canActivate: [browserCheckGuard],
  },
  {
    path: '**',
    loadComponent: () => import('@libs-page-not-found'),
  },
];
