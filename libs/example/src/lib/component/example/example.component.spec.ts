import { HttpClientTestingModule } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationService } from '@libs-shared';
import { SerialNotificationService } from '@libs-web-serial';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceCatalogState } from '../../models';
import {
  DeviceCatalogService,
  ExampleDataService,
  ExampleDownloadService,
} from '../../service';
import { ExampleComponent } from './example.component';

describe('ExampleComponent', () => {
  let component: ExampleComponent;
  let fixture: ComponentFixture<ExampleComponent>;
  const downloadToShellCwd = vi.fn();
  const notifySuccess = vi.fn();
  const notifyError = vi.fn();
  const catalogLoad = vi.fn();
  const catalogRetry = vi.fn();
  const catalogState = signal<DeviceCatalogState>({
    status: 'success',
    devices: [],
  });

  beforeEach(async () => {
    downloadToShellCwd.mockReset();
    notifySuccess.mockReset();
    notifyError.mockReset();
    catalogLoad.mockReset();
    catalogRetry.mockReset();
    catalogState.set({ status: 'success', devices: [] });
    downloadToShellCwd.mockResolvedValue('main-hello-real-world.js');

    await TestBed.configureTestingModule({
      imports: [ExampleComponent, HttpClientTestingModule],
      providers: [
        {
          provide: SerialNotificationService,
          useValue: {
            notifyAutoLoginFailed: () => undefined,
            notifyConnectionSuccess: () => undefined,
            notifyConnectionError: () => undefined,
            notifyLogoutDetected: () => undefined,
            notifyLogoutCancelled: () => undefined,
          },
        },
        {
          provide: ExampleDownloadService,
          useValue: { downloadToShellCwd },
        },
        {
          provide: ExampleDataService,
          useValue: {
            getRemoteExampleList: () => of([]),
          },
        },
        {
          provide: DeviceCatalogService,
          useValue: {
            state: catalogState,
            load: catalogLoad,
            retry: catalogRetry,
          },
        },
        {
          provide: NotificationService,
          useValue: {
            success: notifySuccess,
            error: notifyError,
            warning: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExampleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads the device catalog on init', () => {
    expect(catalogLoad).toHaveBeenCalledTimes(1);
  });

  it('should fill outlet height and use flex shell layout', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.className).toMatch(/\bh-full\b/);
    expect(host.className).toMatch(/\bflex\b/);
    expect(host.className).toMatch(/\bflex-col\b/);
    const outer = host.querySelector(':scope > div');
    expect(outer?.className).toMatch(/\bflex-col\b/);
    expect(outer?.className).toMatch(/\bh-full\b/);
    expect(outer?.className).toMatch(/\boverflow-hidden\b/);
    const card = outer?.querySelector(':scope > div');
    expect(card?.className).toMatch(/\bflex-1\b/);
    expect(card?.className).toMatch(/\boverflow-hidden\b/);
  });

  it('shows the example list after the catalog loads', () => {
    expect(fixture.nativeElement.querySelector('choh-example-list')).toBeTruthy();
  });

  it('shows an error message and retries the catalog', () => {
    catalogState.set({
      status: 'error',
      message: 'Unable to load device examples.',
    });
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('Unable to load device examples.');

    const retryButton = alert.querySelector('button') as HTMLButtonElement;
    expect(retryButton.textContent).toContain('Retry');
    retryButton.click();
    expect(catalogRetry).toHaveBeenCalledTimes(1);
  });

  it('onSaveExample downloads via serial and notifies success', async () => {
    await component.onSaveExample('hello-real-world');

    expect(downloadToShellCwd).toHaveBeenCalledWith('hello-real-world');
    expect(notifySuccess).toHaveBeenCalledWith(
      'Example',
      'main-hello-real-world.js をターミナルのカレントディレクトリに保存しました',
    );
    expect(component.downloadInProgress()).toBe(false);
  });

  it('onSaveExample notifies error on failure', async () => {
    downloadToShellCwd.mockRejectedValue(new Error('Serial port is not connected'));

    await component.onSaveExample('hello-real-world');

    expect(notifyError).toHaveBeenCalledWith(
      'Example',
      'Serial port is not connected',
    );
    expect(component.downloadInProgress()).toBe(false);
  });

  it('onSaveExample ignores clicks while download is in progress', async () => {
    let resolveDownload!: (value: string) => void;
    downloadToShellCwd.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveDownload = resolve;
      }),
    );

    const first = component.onSaveExample('hello-real-world');
    expect(component.downloadInProgress()).toBe(true);

    await component.onSaveExample('gpio-onchange');

    expect(downloadToShellCwd).toHaveBeenCalledTimes(1);
    resolveDownload('main-hello-real-world.js');
    await first;
  });
});
