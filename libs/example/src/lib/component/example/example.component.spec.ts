import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationService } from '@libs-shared';
import { SerialNotificationService } from '@libs-web-serial';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExampleDownloadService } from '../../service';
import { ExampleComponent } from './example.component';

describe('ExampleComponent', () => {
  let component: ExampleComponent;
  let fixture: ComponentFixture<ExampleComponent>;
  const downloadToShellCwd = vi.fn();
  const notifySuccess = vi.fn();
  const notifyError = vi.fn();

  beforeEach(async () => {
    downloadToShellCwd.mockReset();
    notifySuccess.mockReset();
    notifyError.mockReset();
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

  it('onSaveExample downloads via serial and notifies success', async () => {
    await component.onSaveExample({
      id: 'hello-real-world',
      title: 'Lチカ',
      overview: 'blink',
      js: '',
      circuit: '',
      link: '',
    });

    expect(downloadToShellCwd).toHaveBeenCalledWith('hello-real-world');
    expect(notifySuccess).toHaveBeenCalledWith(
      'Example',
      'main-hello-real-world.js をターミナルのカレントディレクトリに保存しました',
    );
    expect(component.downloadInProgress()).toBe(false);
  });

  it('onSaveExample notifies error on failure', async () => {
    downloadToShellCwd.mockRejectedValue(new Error('Serial port is not connected'));

    await component.onSaveExample({
      id: 'hello-real-world',
      title: 'Lチカ',
      overview: 'blink',
      js: '',
      circuit: '',
      link: '',
    });

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

    const first = component.onSaveExample({
      id: 'hello-real-world',
      title: 'Lチカ',
      overview: 'blink',
      js: '',
      circuit: '',
      link: '',
    });
    expect(component.downloadInProgress()).toBe(true);

    await component.onSaveExample({
      id: 'gpio-onchange',
      title: 'スイッチ',
      overview: 'switch',
      js: '',
      circuit: '',
      link: '',
    });

    expect(downloadToShellCwd).toHaveBeenCalledTimes(1);
    resolveDownload('main-hello-real-world.js');
    await first;
  });
});
