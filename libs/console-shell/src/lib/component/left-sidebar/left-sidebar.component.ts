import { Component, computed, inject, input, output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import {
  ConsoleShellLayoutMode,
  ConsoleShellStore,
} from '../../service';
import { FileTreeFeatureComponent } from '@libs-file-manager';

@Component({
  selector: 'lib-left-sidebar',
  imports: [FileTreeFeatureComponent, MatIconButton, MatIcon],
  templateUrl: './left-sidebar.component.html',
  host: {
    class: 'contents',
  },
})
export class LeftSidebarComponent {
  private static readonly OPEN_WIDTH_PX = 280;
  private static readonly OPEN_MIN_WIDTH_PX = 180;
  private static readonly OPEN_MAX_WIDTH_PX = 480;
  private static readonly RAIL_WIDTH_PX = 48;

  leftNavOpen = input<boolean>(true);
  layoutMode = input<ConsoleShellLayoutMode>('docked');
  toggleLeftSidebar = output<void>();

  readonly isOverlay = computed(() => this.layoutMode() === 'overlay');
  readonly isDockedOpen = computed(
    () => this.leftNavOpen() && !this.isOverlay(),
  );

  readonly rootWidthPx = computed(() =>
    this.isDockedOpen()
      ? LeftSidebarComponent.OPEN_WIDTH_PX
      : LeftSidebarComponent.RAIL_WIDTH_PX,
  );
  readonly rootMinWidthPx = computed(() =>
    this.isDockedOpen()
      ? LeftSidebarComponent.OPEN_MIN_WIDTH_PX
      : LeftSidebarComponent.RAIL_WIDTH_PX,
  );
  readonly rootMaxWidthPx = computed(() =>
    this.isDockedOpen()
      ? LeftSidebarComponent.OPEN_MAX_WIDTH_PX
      : LeftSidebarComponent.RAIL_WIDTH_PX,
  );
  readonly rootResize = computed(() =>
    this.isDockedOpen() ? 'horizontal' : 'none',
  );

  readonly overlayWidth = computed(
    () =>
      `min(${LeftSidebarComponent.OPEN_WIDTH_PX}px, 85vw)`,
  );
  readonly overlayMinWidth = computed(
    () =>
      `min(${LeftSidebarComponent.OPEN_MIN_WIDTH_PX}px, 85vw)`,
  );
  readonly overlayMaxWidth = computed(
    () =>
      `min(${LeftSidebarComponent.OPEN_MAX_WIDTH_PX}px, 85vw)`,
  );

  readonly shellStore = inject(ConsoleShellStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  onCurrentPathChange(path: string): void {
    this.shellStore.setFileManagerCurrentPath(path);
    this.shellStore.setSelectedFilePath(null);
  }

  onFileSelected(path: string): void {
    this.shellStore.setSelectedFilePath(path);
    void this.router.navigate(['editor'], { relativeTo: this.route });
  }
}
