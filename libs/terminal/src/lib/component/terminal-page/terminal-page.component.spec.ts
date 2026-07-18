import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SerialNotificationService } from '@libs-web-serial';
import TerminalPageComponent from './terminal-page.component';

describe('TerminalPageComponent', () => {
  let component: TerminalPageComponent;
  let fixture: ComponentFixture<TerminalPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TerminalPageComponent],
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
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TerminalPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
