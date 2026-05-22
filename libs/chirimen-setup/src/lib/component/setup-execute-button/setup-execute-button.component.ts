import { Component, input, output } from '@angular/core';
import { ButtonComponent } from '@libs-shared/component/button';

@Component({
  selector: 'lib-setup-execute-button',
  imports: [ButtonComponent],
  templateUrl: './setup-execute-button.component.html',
})
export class SetupExecuteButtonComponent {
  readonly label = input('セットアップを実行');
  readonly loadingLabel = input('実行中…');
  readonly disabled = input(false);
  readonly loading = input(false);

  readonly execute = output<void>();

  handleClick(): void {
    if (!this.disabled() && !this.loading()) {
      this.execute.emit();
    }
  }
}
