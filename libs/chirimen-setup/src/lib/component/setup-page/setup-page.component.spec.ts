/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { of } from 'rxjs';
import {
  SetupCommandService,
  SetupPostSetupRebootFlowService,
  SetupReadyCheckService,
} from '../../service';
import { ConfirmDialogComponent, DialogService } from '@libs-dialogs';
import { NotificationService } from '@libs-shared';
import { SerialFacadeService } from '@libs-web-serial';
import { SetupPageComponent } from './setup-page.component';

describe('SetupPageComponent', () => {
  let component: SetupPageComponent;
  let fixture: ComponentFixture<SetupPageComponent>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  const rebootInProgress = signal(false);
  let readyCheck: ReturnType<typeof vi.fn>;
  let postSetupRebootRun: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    dialogOpen = vi.fn().mockReturnValue({ closed: of(true) });
    readyCheck = vi.fn().mockResolvedValue({
      ready: true,
      nodeStdout: 'v20.18.1',
      npmStdout: '10.8.2',
    });
    postSetupRebootRun = vi.fn().mockResolvedValue(undefined);
    rebootInProgress.set(false);

    await TestBed.configureTestingModule({
      imports: [SetupPageComponent],
      providers: [
        {
          provide: SetupCommandService,
          useValue: {
            run: vi.fn().mockResolvedValue(undefined),
            buildStepList: vi.fn().mockReturnValue([
              { label: 'step1', phase: 'extra', status: 'pending' },
            ]),
          },
        },
        {
          provide: SetupReadyCheckService,
          useValue: { check: readyCheck },
        },
        {
          provide: SetupPostSetupRebootFlowService,
          useValue: {
            run: postSetupRebootRun,
            inProgress: rebootInProgress.asReadonly(),
          },
        },
        {
          provide: SerialFacadeService,
          useValue: { isConnected: computed(() => true) },
        },
        {
          provide: DialogService,
          useValue: { close: vi.fn(), open: dialogOpen },
        },
        {
          provide: NotificationService,
          useValue: {
            warning: vi.fn(),
            error: vi.fn(),
            success: vi.fn(),
            info: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetupPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('runSetup shows confirm dialog then invokes SetupCommandService', async () => {
    const setup = TestBed.inject(SetupCommandService);
    await component.runSetup();
    expect(dialogOpen).toHaveBeenCalledWith(
      ConfirmDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'CHIRIMEN セットアップを実行',
        }),
      }),
    );
    expect(setup.run).toHaveBeenCalled();
    expect(readyCheck).toHaveBeenCalled();
    expect(postSetupRebootRun).toHaveBeenCalled();
  });

  it('runSetup does not run when confirm is cancelled', async () => {
    dialogOpen.mockReturnValueOnce({ closed: of(false) });
    const setup = TestBed.inject(SetupCommandService);
    await component.runSetup();
    expect(setup.run).not.toHaveBeenCalled();
    expect(postSetupRebootRun).not.toHaveBeenCalled();
  });

  it('shows retry guidance when setup fails', async () => {
    const setup = TestBed.inject(SetupCommandService) as {
      run: ReturnType<typeof vi.fn>;
    };
    setup.run.mockImplementationOnce(
      async (options: {
        onProgress?: (p: {
          stepIndex: number;
          stepTotal: number;
          phase: 'node';
          label: string;
          command: string;
          stdout: string;
          status: 'failed';
          errorMessage?: string;
        }) => void;
      }) => {
        options.onProgress?.({
          stepIndex: 0,
          stepTotal: 1,
          phase: 'node',
          label: 'Node.js バイナリを取得',
          command: 'wget ...',
          stdout: '',
          status: 'failed',
          errorMessage: 'timeout',
        });
        throw new Error('wget failed');
      },
    );

    await component.runSetup();
    expect(component.retryGuidance()).toContain('Node.js バイナリを取得');
    expect(component.retryGuidance()).toContain('再試行手順');
    expect(postSetupRebootRun).not.toHaveBeenCalled();
  });
});
