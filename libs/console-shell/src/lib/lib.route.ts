import { CanDeactivateFn, Routes } from '@angular/router';
import { browserCheckGuard } from '@libs-shared';

type CanComponentDeactivate = {
  canDeactivate?: () => boolean | Promise<boolean>;
};

const canDeactivateGuard: CanDeactivateFn<CanComponentDeactivate> = (
  component,
) => component.canDeactivate?.() ?? true;

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
        canDeactivate: [canDeactivateGuard],
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
