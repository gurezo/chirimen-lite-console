import { Component, computed, inject, input, output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import {
  ConsoleShellLayoutMode,
  ConsoleShellStore,
  LEFT_PANE_WIDTH,
} from '../../service';
import { FileTreeFeatureComponent } from '@libs-file-manager';

@Component({
  selector: 'lib-left-sidebar',
  imports: [FileTreeFeatureComponent, MatIconButton, MatIcon],
  host: {
    class: 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
  },
  templateUrl: './left-sidebar.component.html',
})
export class LeftSidebarComponent {
  leftNavOpen = input<boolean>(true);
  layoutMode = input<ConsoleShellLayoutMode>('docked');
  paneWidthPx = input<number>(LEFT_PANE_WIDTH.wide);
  toggleLeftSidebar = output<void>();
  paneResizeStart = output<PointerEvent>();

  readonly isOverlay = computed(() => this.layoutMode() === 'overlay');

  readonly overlayPaneWidth = computed(
    () => `min(${this.paneWidthPx()}px, 85vw)`,
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

  onResizePointerDown(event: PointerEvent): void {
    this.paneResizeStart.emit(event);
  }
}
