import { Component, computed, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { PinAssignComponent } from '@libs-pin-assign-panel';
import { ConsoleShellLayoutMode } from '../../service';

@Component({
  selector: 'lib-right-sidebar',
  imports: [MatIconButton, MatIcon, PinAssignComponent],
  templateUrl: './right-sidebar.component.html',
  host: {
    class: 'contents',
  },
})
export class RightSidebarComponent {
  /** rail (48) + diagram (300) */
  private static readonly OPEN_WIDTH_PX = 348;
  private static readonly OPEN_MIN_WIDTH_PX = 208;
  private static readonly OPEN_MAX_WIDTH_PX = 528;
  private static readonly RAIL_WIDTH_PX = 48;
  private static readonly OVERLAY_DIAGRAM_WIDTH_PX = 300;
  private static readonly OVERLAY_DIAGRAM_MIN_WIDTH_PX = 160;
  private static readonly OVERLAY_DIAGRAM_MAX_WIDTH_PX = 480;

  rightNavOpen = input<boolean>(true);
  layoutMode = input<ConsoleShellLayoutMode>('docked');
  toggleRightSidebar = output<void>();

  readonly isOverlay = computed(() => this.layoutMode() === 'overlay');
  readonly isDockedOpen = computed(
    () => this.rightNavOpen() && !this.isOverlay(),
  );

  readonly rootWidthPx = computed(() =>
    this.isDockedOpen()
      ? RightSidebarComponent.OPEN_WIDTH_PX
      : RightSidebarComponent.RAIL_WIDTH_PX,
  );
  readonly rootMinWidthPx = computed(() =>
    this.isDockedOpen()
      ? RightSidebarComponent.OPEN_MIN_WIDTH_PX
      : RightSidebarComponent.RAIL_WIDTH_PX,
  );
  readonly rootMaxWidthPx = computed(() =>
    this.isDockedOpen()
      ? RightSidebarComponent.OPEN_MAX_WIDTH_PX
      : RightSidebarComponent.RAIL_WIDTH_PX,
  );
  readonly rootResize = computed(() =>
    this.isDockedOpen() ? 'horizontal' : 'none',
  );
  readonly rootDirection = computed(() =>
    this.isDockedOpen() ? 'rtl' : 'ltr',
  );

  readonly overlayWidth = computed(
    () =>
      `min(${RightSidebarComponent.OVERLAY_DIAGRAM_WIDTH_PX}px, 85vw)`,
  );
  readonly overlayMinWidth = computed(
    () =>
      `min(${RightSidebarComponent.OVERLAY_DIAGRAM_MIN_WIDTH_PX}px, 85vw)`,
  );
  readonly overlayMaxWidth = computed(
    () =>
      `min(${RightSidebarComponent.OVERLAY_DIAGRAM_MAX_WIDTH_PX}px, 85vw)`,
  );
}
