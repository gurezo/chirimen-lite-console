import { Dialog } from '@angular/cdk/dialog';
import { inject, Injectable, Type } from '@angular/core';

export interface DialogConfig {
  height?: string;
  width?: string;
  panelClass?: string;
  data?: unknown;
  disableClose?: boolean;
  autoFocus?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class DialogService {
  private dialog = inject(Dialog);

  open<T>(component: Type<T>, config?: DialogConfig) {
    return this.dialog.open(component, config);
  }

  close() {
    this.dialog.closeAll();
  }

  closeAll() {
    this.dialog.closeAll();
  }
}
