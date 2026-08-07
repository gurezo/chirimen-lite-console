import { Component, inject, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import {
  DialogService,
  RecommendedEnvironmentDialogComponent,
} from '@libs-dialogs';

@Component({
  selector: 'lib-header-toolbar',
  imports: [MatIcon, MatMenu, MatMenuItem, MatMenuTrigger, MatTooltip, RouterLink],
  templateUrl: './header-toolbar.component.html',
})
export class HeaderToolbarComponent {
  private readonly dialog = inject(DialogService);

  eventConnect = output<void>();
  eventDisConnect = output<void>();

  openRecommendedEnvironment(): void {
    this.dialog.open(RecommendedEnvironmentDialogComponent);
  }
}
