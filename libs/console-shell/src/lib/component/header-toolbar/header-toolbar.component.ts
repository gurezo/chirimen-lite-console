import { Component, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'lib-header-toolbar',
  imports: [MatIcon, MatMenu, MatMenuItem, MatMenuTrigger, RouterLink],
  templateUrl: './header-toolbar.component.html',
})
export class HeaderToolbarComponent {
  eventConnect = output<void>();
  eventDisConnect = output<void>();
}
