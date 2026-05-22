import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { NotificationService } from '@libs-shared';
import type { WifiConnectDialogData } from '../../models';
import { WifiConfigService } from '../../service';

@Component({
  selector: 'choh-wifi-connect-dialog',
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
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

  ngOnInit(): void {
    this.ssid = this.data?.initialSsid?.trim() ?? '';
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  async connect(): Promise<void> {
    const trimmed = this.ssid.trim();
    if (!trimmed) {
      this.notify.error('WiFi', 'SSID を入力してください');
      return;
    }
    this.connecting.set(true);
    try {
      await this.wifiConfig.setWiFi(trimmed, this.password);
      this.notify.success('WiFi', '接続処理が完了しました');
      this.dialogRef.close(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '接続に失敗しました';
      this.notify.error('WiFi', msg);
    } finally {
      this.connecting.set(false);
    }
  }
}
