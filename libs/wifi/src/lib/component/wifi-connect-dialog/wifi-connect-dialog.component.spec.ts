/// <reference types="vitest/globals" />
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { NotificationService } from '@libs-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WifiConnectError } from '../../functions';
import { WifiConfigService } from '../../service';
import { WifiConnectDialogComponent } from './wifi-connect-dialog.component';

describe('WifiConnectDialogComponent', () => {
  let component: WifiConnectDialogComponent;
  let fixture: ComponentFixture<WifiConnectDialogComponent>;
  let setWiFi: ReturnType<typeof vi.fn>;
  let dialogRef: {
    close: ReturnType<typeof vi.fn>;
    disableClose: boolean;
  };
  let notify: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    setWiFi = vi.fn().mockResolvedValue(undefined);
    dialogRef = {
      close: vi.fn(),
      disableClose: false,
    };
    notify = {
      success: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [WifiConnectDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: DialogRef, useValue: dialogRef },
        {
          provide: DIALOG_DATA,
          useValue: { initialSsid: 'home-net', ssidReadonly: true },
        },
        { provide: WifiConfigService, useValue: { setWiFi } },
        { provide: NotificationService, useValue: notify },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WifiConnectDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with initial ssid readonly', () => {
    expect(component.ssid).toBe('home-net');
    expect(component.ssidReadonly()).toBe(true);
  });

  it('renders opaque panel surface for CDK backdrop', () => {
    const panel = fixture.nativeElement.querySelector(
      ':scope > div',
    ) as HTMLElement | null;
    expect(panel).toBeTruthy();
    expect(panel!.classList.contains('bg-white')).toBe(true);
    expect(panel!.classList.contains('shadow-lg')).toBe(true);
  });

  it('toggles password visibility', () => {
    expect(component.passwordVisible()).toBe(false);
    component.togglePasswordVisibility();
    expect(component.passwordVisible()).toBe(true);
    component.togglePasswordVisibility();
    expect(component.passwordVisible()).toBe(false);
  });

  it('clears password and closes on cancel', () => {
    component.password = 'secret';
    component.cancel();
    expect(component.password).toBe('');
    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });

  it('does not cancel while connecting', () => {
    component.connecting.set(true);
    component.password = 'secret';
    component.cancel();
    expect(component.password).toBe('secret');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('prevents double submit while connecting', async () => {
    let resolveSet!: () => void;
    setWiFi.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSet = resolve;
      }),
    );
    component.password = 'pw';
    const first = component.connect();
    const second = component.connect();
    await Promise.resolve();
    expect(setWiFi).toHaveBeenCalledTimes(1);
    resolveSet();
    await first;
    await second;
  });

  it('shows auth failure message without closing', async () => {
    setWiFi.mockRejectedValueOnce(
      new WifiConnectError(
        'auth',
        '認証に失敗しました。パスワードを確認してください',
      ),
    );
    component.password = 'bad';
    await component.connect();
    expect(component.feedback()?.kind).toBe('error');
    expect(component.feedback()?.message).toContain('認証に失敗');
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(dialogRef.disableClose).toBe(false);
  });

  it('shows command failure message', async () => {
    setWiFi.mockRejectedValueOnce(
      new WifiConnectError('command', '接続コマンドの実行に失敗しました'),
    );
    await component.connect();
    expect(component.feedback()?.message).toContain('接続コマンド');
  });

  it('closes with true and clears password on success', async () => {
    component.password = 'ok';
    await component.connect();
    expect(notify.success).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
    expect(component.password).toBe('');
  });
});
