import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  type SerialConnectionViewModel,
  SerialConnectionViewModelFacade,
} from '@libs-web-serial-data-access';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectPageComponent } from './connect-page.component';

function vmBase(
  overrides: Partial<SerialConnectionViewModel> = {},
): SerialConnectionViewModel {
  return {
    isBrowserSupported: true,
    isConnected: false,
    isConnecting: false,
    isLoggedIn: false,
    isInitializing: false,
    errorMessage: null,
    ...overrides,
  };
}

describe('ConnectPageComponent', () => {
  let component: ConnectPageComponent;
  let fixture: ComponentFixture<ConnectPageComponent>;
  let vmSubject: BehaviorSubject<SerialConnectionViewModel>;
  let connect: ReturnType<typeof vi.fn>;
  let clearError: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vmSubject = new BehaviorSubject(vmBase());
    connect = vi.fn();
    clearError = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ConnectPageComponent],
      providers: [
        {
          provide: SerialConnectionViewModelFacade,
          useValue: {
            vm$: vmSubject.asObservable(),
            connect,
            clearError,
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

  it('should call facade connect when onConnect is called', () => {
    connect.mockClear();
    component.onConnect();
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('reports disconnected when vm is not connected', async () => {
    vmSubject.next(vmBase({ isConnected: false }));
    const vm = await firstValueFrom(component.vm$);
    expect(vm.isConnected).toBe(false);
  });

  it('reports connected when vm is connected', async () => {
    vmSubject.next(vmBase({ isConnected: true }));
    const vm = await firstValueFrom(component.vm$);
    expect(vm.isConnected).toBe(true);
  });

  it('calls facade clearError from onClearError', () => {
    clearError.mockClear();
    component.onClearError();
    expect(clearError).toHaveBeenCalledTimes(1);
  });
});
