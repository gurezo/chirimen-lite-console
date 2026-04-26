import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SerialFacadeService, SerialNotificationService } from '@libs-web-serial-data-access';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectPageComponent } from './connect-page.component';

describe('ConnectPageComponent', () => {
  let component: ConnectPageComponent;
  let fixture: ComponentFixture<ConnectPageComponent>;
  let isConnected: BehaviorSubject<boolean>;
  let connectResult: { ok: true } | { ok: false; errorMessage: string };
  let connect$: ReturnType<typeof vi.fn>;
  let notifySuccess: ReturnType<typeof vi.fn>;
  let notifyError: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    isConnected = new BehaviorSubject<boolean>(false);
    connectResult = { ok: true };
    connect$ = vi.fn();
    notifySuccess = vi.fn();
    notifyError = vi.fn();

    connect$.mockImplementation(() => of(connectResult));

    await TestBed.configureTestingModule({
      imports: [ConnectPageComponent],
      providers: [
        {
          provide: SerialFacadeService,
          useValue: {
            get isConnected$() {
              return isConnected.asObservable();
            },
            connect$,
          },
        },
        {
          provide: SerialNotificationService,
          useValue: {
            notifyConnectionSuccess: notifySuccess,
            notifyConnectionError: notifyError,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConnectPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call connect$ when onConnect is called', () => {
    connect$.mockClear();
    component.onConnect();
    expect(connect$).toHaveBeenCalledTimes(1);
  });

  it('should map connectionStatus$ to disconnected when not connected', async () => {
    isConnected.next(false);
    const status = await firstValueFrom(component.connectionStatus$);
    expect(status).toBe('disconnected');
  });

  it('should map connectionStatus$ to connected when connected', async () => {
    isConnected.next(true);
    const status = await firstValueFrom(component.connectionStatus$);
    expect(status).toBe('connected');
  });

  it('should notify on successful connect from onConnect', () => {
    connectResult = { ok: true };
    connect$.mockImplementation(() => of(connectResult));
    component.onConnect();
    expect(notifySuccess).toHaveBeenCalledTimes(1);
    expect(notifyError).not.toHaveBeenCalled();
  });

  it('should notify on failed connect from onConnect', () => {
    connectResult = { ok: false, errorMessage: 'failed' };
    connect$.mockImplementation(() => of(connectResult));
    component.onConnect();
    expect(notifyError).toHaveBeenCalledWith('failed');
    expect(notifySuccess).not.toHaveBeenCalled();
  });
});
