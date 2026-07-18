import { Component, computed, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { PinAssignComponent } from '@libs-pin-assign-panel';
import { ConsoleShellLayoutMode } from '../../service';

@Component({
  selector: 'lib-right-sidebar',
  imports: [MatIconButton, MatIcon, PinAssignComponent],
  templateUrl: './right-sidebar.component.html',
  styleUrl: './right-sidebar.component.css',
  host: {
    '[class.is-docked-open]': 'isDockedOpen()',
    '[class.is-rail]': 'isRail()',
  },
})
export class RightSidebarComponent {
  rightNavOpen = input<boolean>(true);
  layoutMode = input<ConsoleShellLayoutMode>('docked');
  toggleRightSidebar = output<void>();

  readonly isOverlay = computed(() => this.layoutMode() === 'overlay');
  readonly isDockedOpen = computed(
    () => this.rightNavOpen() && !this.isOverlay(),
  );
  readonly isRail = computed(() => !this.isDockedOpen());
}
