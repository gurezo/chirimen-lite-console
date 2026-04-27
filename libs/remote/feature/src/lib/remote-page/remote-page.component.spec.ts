import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogService } from '@libs-dialogs-util';
import {
  RemoteRunService,
  RemoteStatusService,
  RemoteStopService,
} from '@libs-remote-data-access';
import { NotificationService } from '@libs-shared-ui';
import { SerialFacadeService } from '@libs-web-serial-data-access';
import { RemotePageComponent } from './remote-page.component';

const PLAIN_ROW =
  '[0]  RelayServer  node  /home/pi/RelayServer.js  1111  2222  /tmp/a.log  0:0:0:1';

describe('RemotePageComponent', () => {
  let component: RemotePageComponent;
  let fixture: ComponentFixture<RemotePageComponent>;
  let serialConnected: BehaviorSubject<boolean>;

  beforeEach(async () => {
    serialConnected = new BehaviorSubject(true);
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
          useFactory: () => ({
            get isConnected$() {
              return serialConnected.asObservable();
            },
          }),
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
    serialConnected.next(false);
    const notify = TestBed.inject(NotificationService) as unknown as {
      warning: ReturnType<typeof vi.fn>;
    };
    await component.refreshList();
    expect(notify.warning).toHaveBeenCalled();
  });

  it('startScript calls remoteRun.start', async () => {
    component.scriptPath = '/app.js';
    const run = TestBed.inject(RemoteRunService);
    await component.startScript();
    expect(run.start).toHaveBeenCalledWith('/app.js');
  });
});
