import { Component, inject, input, output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { ConsoleShellStore } from '../../service';
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
  toggleLeftSidebar = output<void>();

  private shellStore = inject(ConsoleShellStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  onFileSelected(path: string): void {
    this.shellStore.setSelectedFilePath(path);
    void this.router.navigate(['editor'], { relativeTo: this.route });
  }
}
