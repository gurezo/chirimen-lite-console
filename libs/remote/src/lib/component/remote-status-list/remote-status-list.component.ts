import { Component, input, output } from '@angular/core';
import type { ForeverProcess } from '@libs-shared';
import { ButtonComponent } from '@libs-shared';

@Component({
  selector: 'lib-remote-status-list',
  imports: [ButtonComponent],
  templateUrl: './remote-status-list.component.html',
})
export class RemoteStatusListComponent {
  readonly processes = input<ForeverProcess[]>([]);
  readonly selected = input<ForeverProcess | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly fetched = input(false);

  readonly rowSelected = output<ForeverProcess>();
  readonly retry = output<void>();

  trackKey(p: ForeverProcess): string {
    return `${p.listIndex}\0${p.uid}`;
  }

  isSelected(p: ForeverProcess): boolean {
    const s = this.selected();
    return s !== null && s.listIndex === p.listIndex && s.uid === p.uid;
  }
}
