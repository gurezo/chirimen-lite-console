import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { NotificationService } from '@libs-shared';
import {
  messageForWifiConnectKind,
  toWifiConnectError,
  WifiConnectError,
} from '../../functions';
import type { WifiConnectDialogData } from '../../models';
import { WifiConfigService } from '../../service';

@Component({
  selector: 'choh-wifi-connect-dialog',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconButton,
    MatIcon,
  ],
  templateUrl: './wifi-connect-dialog.component.html',
})
export class WifiConnectDialogComponent implements OnInit {
  private readonly dialogRef = inject(DialogRef<boolean>);
  private readonly data = inject<WifiConnectDialogData | null>(DIALOG_DATA, {
    optional: true,
  });
  private readonly wifiConfig = inject(WifiConfigService);
  private readonly notify = inject(NotificationService);

  ssid = '';
  password = '';
  readonly connecting = signal(false);
  readonly passwordVisible = signal(false);
  readonly feedback = signal<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);

  ngOnInit(): void {
    this.ssid = this.data?.initialSsid?.trim() ?? '';
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((v) => !v);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  async connect(): Promise<void> {
    const trimmed = this.ssid.trim();
    if (!trimmed) {
      this.feedback.set({
        kind: 'error',
        message: 'SSID を入力してください',
      });
      return;
    }
    if (this.connecting()) {
      return;
    }
    this.connecting.set(true);
    this.feedback.set(null);
    try {
      await this.wifiConfig.setWiFi(trimmed, this.password);
      const successMessage = '接続処理が完了しました';
      this.feedback.set({ kind: 'success', message: successMessage });
      this.notify.success('WiFi', successMessage);
      this.dialogRef.close(true);
    } catch (e: unknown) {
      const wifiError =
        e instanceof WifiConnectError ? e : toWifiConnectError(e);
      const msg = messageForWifiConnectKind(wifiError.kind);
      this.feedback.set({ kind: 'error', message: msg });
      this.notify.error('WiFi', msg);
    } finally {
      this.connecting.set(false);
    }
  }
}
