/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SetupCommandService } from '@libs-chirimen-setup-data-access';
import { DialogService } from '@libs-dialogs-util';
import { NotificationService } from '@libs-shared-ui';
import { SerialFacadeService } from '@libs-web-serial-data-access';
import { of } from 'rxjs';
import { SetupPageComponent } from './setup-page.component';

describe('SetupPageComponent', () => {
  let component: SetupPageComponent;
  let fixture: ComponentFixture<SetupPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetupPageComponent],
      providers: [
        {
          provide: SetupCommandService,
          useValue: { run: vi.fn().mockResolvedValue(undefined) },
        },
        {
          provide: SerialFacadeService,
          useValue: { isConnected$: of(true) },
        },
        { provide: DialogService, useValue: { close: vi.fn() } },
        {
          provide: NotificationService,
          useValue: {
            warning: vi.fn(),
            error: vi.fn(),
            success: vi.fn(),
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

  it('runSetup invokes SetupCommandService when connected', async () => {
    const setup = TestBed.inject(SetupCommandService);
    await component.runSetup();
    expect(setup.run).toHaveBeenCalled();
  });
});
