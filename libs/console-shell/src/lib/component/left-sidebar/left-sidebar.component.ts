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
  styleUrl: './left-sidebar.component.css',
  host: {
    '[class.is-docked-open]': 'isDockedOpen()',
    '[class.is-rail]': 'isRail()',
  },
})
export class LeftSidebarComponent {
  leftNavOpen = input<boolean>(true);
  layoutMode = input<ConsoleShellLayoutMode>('docked');
  toggleLeftSidebar = output<void>();

  readonly isOverlay = computed(() => this.layoutMode() === 'overlay');
  readonly isDockedOpen = computed(
    () => this.leftNavOpen() && !this.isOverlay(),
  );
  readonly isRail = computed(() => !this.isDockedOpen());

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
