import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogService } from '@libs-dialogs';
import { RemoteRunService } from '../../service';
import { RemoteStatusService } from '../../service';
import { RemoteStopService } from '../../service';
import { ConsoleShellStore, NotificationService } from '@libs-shared';
import { SerialFacadeService } from '@libs-web-serial';
import { RemotePageComponent } from './remote-page.component';

const PLAIN_ROW =
  '[0]  RelayServer  node  /home/pi/RelayServer.js  1111  2222  /tmp/a.log  0:0:0:1';

describe('RemotePageComponent', () => {
  let component: RemotePageComponent;
  let fixture: ComponentFixture<RemotePageComponent>;
  let serialConnected: ReturnType<typeof signal<boolean>>;
  let selectedFilePath: ReturnType<typeof signal<string | null>>;

  beforeEach(async () => {
    serialConnected = signal(true);
    selectedFilePath = signal<string | null>(null);
    const dialogRef = { closed: of(true) };
    await TestBed.configureTestingModule({
      imports: [RemotePageComponent],
      providers: [
        {
          provide: DialogService,
          useValue: {
            close: vi.fn(),
            open: vi.fn().mockReturnValue(dialogRef),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            success: vi.fn(),
            error: vi.fn(),
            warning: vi.fn(),
            info: vi.fn(),
          },
        },
        {
          provide: SerialFacadeService,
          useValue: {
            isConnected: computed(() => serialConnected()),
          },
        },
        {
          provide: ConsoleShellStore,
          useValue: {
            selectedFilePath: computed(() => selectedFilePath()),
          },
        },
        {
          provide: RemoteStatusService,
          useValue: { listPlain: vi.fn().mockResolvedValue(PLAIN_ROW) },
        },
        {
          provide: RemoteRunService,
          useValue: { start: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: RemoteStopService,
          useValue: {
            stopAll: vi.fn().mockResolvedValue(undefined),
            stopTarget: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RemotePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('refreshList parses forever rows', async () => {
    await component.refreshList();
    expect(component.processes.length).toBe(1);
    expect(component.processes[0]?.uid).toBe('RelayServer');
  });

  it('refreshList warns when serial disconnected', async () => {
    serialConnected.set(false);
    const notify = TestBed.inject(NotificationService) as unknown as {
      warning: ReturnType<typeof vi.fn>;
    };
    await component.refreshList();
    expect(notify.warning).toHaveBeenCalled();
  });

  it('startScript confirms then calls remoteRun.start', async () => {
    component.scriptPath = '/app.js';
    const run = TestBed.inject(RemoteRunService);
    const dialog = TestBed.inject(DialogService);
    await component.startScript();
    expect(dialog.open).toHaveBeenCalled();
    expect(run.start).toHaveBeenCalledWith('/app.js');
  });

  it('startScript skips start when confirm is cancelled', async () => {
    const dialog = TestBed.inject(DialogService) as unknown as {
      open: ReturnType<typeof vi.fn>;
    };
    dialog.open.mockReturnValue({ closed: of(false) });
    component.scriptPath = '/app.js';
    const run = TestBed.inject(RemoteRunService);
    await component.startScript();
    expect(run.start).not.toHaveBeenCalled();
  });

  it('startScript restarts when the same script is already running', async () => {
    component.scriptPath = '/home/pi/RelayServer.js';
    component.processes = [
      {
        listIndex: 0,
        uid: 'RelayServer',
        command: 'node',
        script: '/home/pi/RelayServer.js',
        running: true,
      },
    ];
    const run = TestBed.inject(RemoteRunService);
    const stop = TestBed.inject(RemoteStopService);
    await component.startScript();
    expect(stop.stopTarget).toHaveBeenCalledWith('RelayServer');
    expect(run.start).toHaveBeenCalledWith('/home/pi/RelayServer.js');
  });

  it('prefills scriptPath from File Manager .js selection on init', async () => {
    selectedFilePath.set('/home/pi/myApp/main.js');
    const next = TestBed.createComponent(RemotePageComponent);
    next.detectChanges();
    expect(next.componentInstance.scriptPath).toBe('/home/pi/myApp/main.js');
  });

  it('useSelectedFile copies selectedJsPath into scriptPath', () => {
    selectedFilePath.set('/home/pi/app.js');
    component.scriptPath = '/other.js';
    component.useSelectedFile();
    expect(component.scriptPath).toBe('/home/pi/app.js');
  });

  it('selectedJsPath is null for non-js selection', () => {
    selectedFilePath.set('/home/pi/readme.md');
    expect(component.selectedJsPath()).toBeNull();
  });

  it('serialConnected reflects SerialFacadeService isConnected', () => {
    expect(component.serialConnected()).toBe(true);
    serialConnected.set(false);
    expect(component.serialConnected()).toBe(false);
  });

  it('startScript warns and does not start when serial disconnected', async () => {
    serialConnected.set(false);
    component.scriptPath = '/app.js';
    const run = TestBed.inject(RemoteRunService);
    const notify = TestBed.inject(NotificationService) as unknown as {
      warning: ReturnType<typeof vi.fn>;
    };
    await component.startScript();
    expect(notify.warning).toHaveBeenCalled();
    expect(run.start).not.toHaveBeenCalled();
  });

  it('startScript shows error notification when forever start fails', async () => {
    component.scriptPath = '/app.js';
    const run = TestBed.inject(RemoteRunService) as unknown as {
      start: ReturnType<typeof vi.fn>;
    };
    run.start.mockRejectedValueOnce(new Error('forever: start failed: EACCES'));
    const notify = TestBed.inject(NotificationService) as unknown as {
      error: ReturnType<typeof vi.fn>;
    };
    await component.startScript();
    expect(notify.error).toHaveBeenCalledWith(
      'Remote',
      'forever: start failed: EACCES',
    );
  });

  it('does not prefill scriptPath when selected file is not .js', () => {
    selectedFilePath.set('/home/pi/readme.md');
    const next = TestBed.createComponent(RemotePageComponent);
    next.detectChanges();
    expect(next.componentInstance.scriptPath).toBe('');
  });

  it('stopSelected confirms then calls remoteStop.stopTarget', async () => {
    component.selected = {
      listIndex: 0,
      uid: 'RelayServer',
      command: 'node',
      script: '/home/pi/RelayServer.js',
      pid: '2222',
      running: true,
    };
    const stop = TestBed.inject(RemoteStopService);
    const dialog = TestBed.inject(DialogService);
    await component.stopSelected();
    expect(dialog.open).toHaveBeenCalled();
    expect(stop.stopTarget).toHaveBeenCalledWith('RelayServer');
  });

  it('stopSelected skips stop when confirm is cancelled', async () => {
    const dialog = TestBed.inject(DialogService) as unknown as {
      open: ReturnType<typeof vi.fn>;
    };
    dialog.open.mockReturnValue({ closed: of(false) });
    component.selected = {
      listIndex: 0,
      uid: 'RelayServer',
      command: 'node',
      script: '/home/pi/RelayServer.js',
      running: true,
    };
    const stop = TestBed.inject(RemoteStopService);
    await component.stopSelected();
    expect(stop.stopTarget).not.toHaveBeenCalled();
  });

  it('stopSelected does nothing when nothing is selected', async () => {
    component.selected = null;
    const stop = TestBed.inject(RemoteStopService);
    const dialog = TestBed.inject(DialogService);
    await component.stopSelected();
    expect(dialog.open).not.toHaveBeenCalled();
    expect(stop.stopTarget).not.toHaveBeenCalled();
  });

  it('stopSelected does nothing when selected process is already stopped', async () => {
    component.selected = {
      listIndex: 0,
      uid: 'RelayServer',
      command: 'node',
      script: '/home/pi/RelayServer.js',
      running: false,
    };
    const stop = TestBed.inject(RemoteStopService);
    const dialog = TestBed.inject(DialogService);
    await component.stopSelected();
    expect(dialog.open).not.toHaveBeenCalled();
    expect(stop.stopTarget).not.toHaveBeenCalled();
  });

  it('stopSelected shows error notification when forever stop fails', async () => {
    component.selected = {
      listIndex: 0,
      uid: 'RelayServer',
      command: 'node',
      script: '/home/pi/RelayServer.js',
      running: true,
    };
    const stop = TestBed.inject(RemoteStopService) as unknown as {
      stopTarget: ReturnType<typeof vi.fn>;
    };
    stop.stopTarget.mockRejectedValueOnce(
      new Error('forever: stop failed: ENOENT'),
    );
    const notify = TestBed.inject(NotificationService) as unknown as {
      error: ReturnType<typeof vi.fn>;
    };
    await component.stopSelected();
    expect(notify.error).toHaveBeenCalledWith(
      'Remote',
      'forever: stop failed: ENOENT',
    );
  });
});
