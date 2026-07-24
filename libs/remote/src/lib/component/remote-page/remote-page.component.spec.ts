import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogService } from '@libs-dialogs';
import { RemoteRunService } from '../../service';
import { RemoteStatusService } from '../../service';
import { RemoteStopService } from '../../service';
import { NotificationService } from '@libs-shared';
import { SerialFacadeService } from '@libs-web-serial';
import { RemotePageComponent } from './remote-page.component';

const PLAIN_ROW =
  '[0]  RelayServer  node  /home/pi/RelayServer.js  1111  2222  /tmp/a.log  0:0:0:1';

describe('RemotePageComponent', () => {
  let component: RemotePageComponent;
  let fixture: ComponentFixture<RemotePageComponent>;
  let serialConnected: ReturnType<typeof signal<boolean>>;

  beforeEach(async () => {
    serialConnected = signal(true);
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
});
