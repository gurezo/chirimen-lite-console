import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  type SerialConnectionViewModel,
  SerialConnectionViewModelFacade,
} from '@libs-web-serial';
import { computed, signal } from '@angular/core';
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
    setupStatus: 'idle',
    errorMessage: null,
    ...overrides,
  };
}

describe('ConnectPageComponent', () => {
  let component: ConnectPageComponent;
  let fixture: ComponentFixture<ConnectPageComponent>;
  let vmSignal: ReturnType<typeof signal<SerialConnectionViewModel>>;
  let connect: ReturnType<typeof vi.fn>;
  let clearError: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vmSignal = signal(vmBase());
    connect = vi.fn();
    clearError = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ConnectPageComponent],
      providers: [
        {
          provide: SerialConnectionViewModelFacade,
          useValue: {
            vm: computed(() => vmSignal()),
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

  it('reports disconnected when vm is not connected', () => {
    vmSignal.set(vmBase({ isConnected: false }));
    expect(component.vm().isConnected).toBe(false);
  });

  it('reports connected when vm is connected', () => {
    vmSignal.set(vmBase({ isConnected: true }));
    expect(component.vm().isConnected).toBe(true);
  });

  it('calls facade clearError from onClearError', () => {
    clearError.mockClear();
    component.onClearError();
    expect(clearError).toHaveBeenCalledTimes(1);
  });
});
