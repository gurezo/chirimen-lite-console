import { Component, input, output } from '@angular/core';
import type { ForeverProcess } from '@libs-shared';

@Component({
  selector: 'lib-remote-status-list',
  templateUrl: './remote-status-list.component.html',
})
export class RemoteStatusListComponent {
  readonly processes = input<ForeverProcess[]>([]);
  readonly selected = input<ForeverProcess | null>(null);

  readonly rowSelected = output<ForeverProcess>();

  trackKey(p: ForeverProcess): string {
    return `${p.listIndex}\0${p.uid}`;
  }

  isSelected(p: ForeverProcess): boolean {
    const s = this.selected();
    return s !== null && s.listIndex === p.listIndex && s.uid === p.uid;
  }
}
