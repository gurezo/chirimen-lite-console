import { Routes } from '@angular/router';
import { browserCheckGuard } from '@libs-shared';

export const consoleShellRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./component/console-shell/console-shell.component').then(
        (m) => m.ConsoleShellComponent,
      ),
    canActivate: [browserCheckGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'terminal' },
      {
        path: 'terminal',
        loadComponent: () =>
          import('@libs-terminal').then((m) => m.TerminalPageComponent),
      },
      {
        path: 'editor',
        loadComponent: () =>
          import('@libs-editor').then((m) => m.EditorPageComponent),
      },
      {
        path: 'example',
        loadComponent: () =>
          import('@libs-example').then((m) => m.ExampleComponent),
      },
      {
        path: 'wifi',
        loadComponent: () =>
          import('@libs-wifi').then((m) => m.WifiPageComponent),
      },
    ],
  },
];
