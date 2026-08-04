import { Component, computed, inject, input, output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import type { FileRenamedEvent } from '@libs-file-manager';
import { FileTreeFeatureComponent } from '@libs-file-manager';
import {
  ConsoleShellLayoutMode,
  ConsoleShellStore,
  EDITOR_DRAFT_LIFECYCLE,
  LEFT_PANE_WIDTH,
  RAIL_WIDTH_PX,
} from '@libs-shared';

/** Keyboard resize step for the left panel separator (px). */
export const LEFT_PANE_RESIZE_STEP_PX = 16;

@Component({
  selector: 'lib-left-sidebar',
  imports: [FileTreeFeatureComponent, MatIconButton, MatIcon, MatTooltip],
  templateUrl: './left-sidebar.component.html',
  styleUrl: './left-sidebar.component.css',
  host: {
    class: 'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
  },
})
export class LeftSidebarComponent {
  leftNavOpen = input<boolean>(true);
  layoutMode = input<ConsoleShellLayoutMode>('docked');
  paneWidthPx = input<number>(LEFT_PANE_WIDTH.default);
  toggleLeftSidebar = output<void>();
  paneResizeStart = output<PointerEvent>();
  paneResizeBy = output<number>();

  readonly isOverlay = computed(() => this.layoutMode() === 'overlay');
  readonly isDockedOpen = computed(
    () => this.leftNavOpen() && !this.isOverlay(),
  );

  /** Tree area width = full pane minus chrome rail. */
  readonly treeWidthPx = computed(
    () => Math.max(0, this.paneWidthPx() - RAIL_WIDTH_PX),
  );

  readonly overlayWidth = computed(
    () => `min(${this.paneWidthPx()}px, 85vw)`,
  );

  readonly contentLabel = 'ファイルツリー';

  readonly panelToggleLabel = computed(() =>
    this.leftNavOpen() ? 'ファイルツリーを閉じる' : 'ファイルツリーを開く',
  );

  readonly shellStore = inject(ConsoleShellStore);
  private readonly draftLifecycle = inject(EDITOR_DRAFT_LIFECYCLE, {
    optional: true,
  });
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly hasUnsavedDraft = (path: string): boolean =>
    this.draftLifecycle?.has(path) ?? false;

  onCurrentPathChange(path: string): void {
    this.shellStore.setFileManagerCurrentPath(path);
  }

  onFileSelected(path: string): void {
    this.shellStore.setSelectedFilePath(path);
    void this.router.navigate(['editor'], { relativeTo: this.route });
  }

  onFileCreated(path: string): void {
    this.onFileSelected(path);
  }

  onFileRenamed({ from, to }: FileRenamedEvent): void {
    this.draftLifecycle?.rename(from, to);
    if (this.shellStore.selectedFilePath() === from) {
      this.shellStore.setSelectedFilePath(to);
    }
  }

  onFileDeleted(path: string): void {
    this.draftLifecycle?.clear(path);
    if (this.shellStore.selectedFilePath() === path) {
      this.shellStore.setSelectedFilePath(null);
    }
  }

  onResizePointerDown(event: PointerEvent): void {
    this.paneResizeStart.emit(event);
  }

  onResizeKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.paneResizeBy.emit(LEFT_PANE_RESIZE_STEP_PX);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.paneResizeBy.emit(-LEFT_PANE_RESIZE_STEP_PX);
    }
  }
}
