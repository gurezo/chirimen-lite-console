import { Component, computed, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { PinAssignComponent } from '@libs-pin-assign-panel';
import {
  ConsoleShellLayoutMode,
  RIGHT_DIAGRAM_WIDTH,
} from '../../service';

@Component({
  selector: 'lib-right-sidebar',
  imports: [MatIconButton, MatIcon, PinAssignComponent],
  host: {
    class: 'flex min-h-0 min-w-0 flex-1 flex-col',
  },
  templateUrl: './right-sidebar.component.html',
})
export class RightSidebarComponent {
  rightNavOpen = input<boolean>(true);
  layoutMode = input<ConsoleShellLayoutMode>('docked');
  diagramWidthPx = input<number>(RIGHT_DIAGRAM_WIDTH.wide);
  toggleRightSidebar = output<void>();
  paneResizeStart = output<PointerEvent>();

  readonly isOverlay = computed(() => this.layoutMode() === 'overlay');

  readonly overlayPaneWidth = computed(
    () => `min(${this.diagramWidthPx()}px, 85vw)`,
  );

  onResizePointerDown(event: PointerEvent): void {
    this.paneResizeStart.emit(event);
  }
}
