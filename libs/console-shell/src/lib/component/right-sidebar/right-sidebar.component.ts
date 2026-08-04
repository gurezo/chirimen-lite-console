import { Component, computed, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { PinAssignComponent } from '@libs-pin-assign-panel';
import {
  ConsoleShellLayoutMode,
  RIGHT_DIAGRAM_WIDTH,
} from '@libs-shared';

/** Keyboard resize step for the right panel separator (px). */
export const RIGHT_PANE_RESIZE_STEP_PX = 16;

@Component({
  selector: 'lib-right-sidebar',
  imports: [MatIconButton, MatIcon, MatTooltip, PinAssignComponent],
  templateUrl: './right-sidebar.component.html',
  styleUrl: './right-sidebar.component.css',
  host: {
    class: 'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
  },
})
export class RightSidebarComponent {
  rightNavOpen = input<boolean>(true);
  layoutMode = input<ConsoleShellLayoutMode>('docked');
  diagramWidthPx = input<number>(RIGHT_DIAGRAM_WIDTH.default);
  toggleRightSidebar = output<void>();
  paneResizeStart = output<PointerEvent>();
  paneResizeBy = output<number>();

  readonly isOverlay = computed(() => this.layoutMode() === 'overlay');
  readonly isDockedOpen = computed(
    () => this.rightNavOpen() && !this.isOverlay(),
  );

  readonly overlayWidth = computed(
    () => `min(${this.diagramWidthPx()}px, 85vw)`,
  );

  readonly contentLabel = 'ピン配置';

  readonly panelToggleLabel = computed(() =>
    this.rightNavOpen() ? 'ピン配置を閉じる' : 'ピン配置を開く',
  );

  onResizePointerDown(event: PointerEvent): void {
    this.paneResizeStart.emit(event);
  }

  onResizeKeydown(event: KeyboardEvent): void {
    // Separator is on the left edge: ArrowLeft grows the pane, ArrowRight shrinks.
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.paneResizeBy.emit(RIGHT_PANE_RESIZE_STEP_PX);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.paneResizeBy.emit(-RIGHT_PANE_RESIZE_STEP_PX);
    }
  }
}
