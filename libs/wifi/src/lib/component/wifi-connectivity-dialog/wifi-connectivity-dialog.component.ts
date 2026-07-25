import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { WifiConnectivityDialogData } from '../../models';

@Component({
  selector: 'choh-wifi-connectivity-dialog',
  imports: [MatButtonModule],
  templateUrl: './wifi-connectivity-dialog.component.html',
})
export class WifiConnectivityDialogComponent {
  private readonly dialogRef = inject(DialogRef<void>);
  private readonly data = inject<WifiConnectivityDialogData>(DIALOG_DATA);

  readonly status = this.data.status;
  readonly detail = this.data.detail;
  readonly isOk = this.status === 'ok';

  close(): void {
    this.dialogRef.close();
  }
}
