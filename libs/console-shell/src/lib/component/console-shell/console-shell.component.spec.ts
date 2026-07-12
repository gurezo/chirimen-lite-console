import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import {
  SerialConnectionViewModelFacade,
  type SerialConnectionViewModel,
} from '@libs-web-serial';
import { DialogService } from '@libs-dialogs';
import { ConsoleShellStore } from '../../service';
import { EMPTY, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleShellComponent } from './console-shell.component';

function vmDefaults(
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

function createConnectionFacadeMock(initialConnected = false) {
  const vmSignal = signal(vmDefaults({ isConnected: initialConnected }));
  const connect = vi.fn();
  const disconnect = vi.fn();
  const sendCommand = vi.fn();

  const facade = {
    vm: computed(() => vmSignal()),
    connect,
    disconnect,
    sendCommand,
  };

  return { facade, vmSignal };
}

describe('ConsoleShellComponent', () => {
  let component: ConsoleShellComponent;
  let fixture: ComponentFixture<ConsoleShellComponent>;
  let connect: ReturnType<typeof vi.fn>;
  let disconnect: ReturnType<typeof vi.fn>;
  let sendCommand: ReturnType<typeof vi.fn>;
  let vmSignal: ReturnType<typeof signal<SerialConnectionViewModel>>;
  let openDialog: ReturnType<typeof vi.fn>;
  let closeAllDialog: ReturnType<typeof vi.fn>;
  let setActivePanel: ReturnType<typeof vi.fn>;
  let closeDialog: ReturnType<typeof vi.fn>;
  let openShellDialog: ReturnType<typeof vi.fn>;
  let applyConnectedLayout: ReturnType<typeof vi.fn>;
  let resetLayoutAfterDisconnect: ReturnType<typeof vi.fn>;
  let navigateSpy: ReturnType<typeof vi.fn>;
  let activatedRouteMock: ActivatedRoute;

  beforeEach(async () => {
    navigateSpy = vi.fn().mockResolvedValue(true);
    activatedRouteMock = {
      firstChild: { snapshot: { url: [{ path: 'terminal' }] } },
    } as unknown as ActivatedRoute;

    const { facade, vmSignal: vm } = createConnectionFacadeMock(false);
    vmSignal = vm;
    connect = facade.connect;
    disconnect = facade.disconnect;
    sendCommand = facade.sendCommand;
    applyConnectedLayout = vi.fn();
    resetLayoutAfterDisconnect = vi.fn();

    openDialog = vi.fn().mockReturnValue({ closed: of(undefined) });
    closeAllDialog = vi.fn();
    setActivePanel = vi.fn();
    closeDialog = vi.fn();
    openShellDialog = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ConsoleShellComponent],
      providers: [
        {
          provide: Router,
          useValue: { navigate: navigateSpy, events: EMPTY },
        },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        {
          provide: SerialConnectionViewModelFacade,
          useValue: facade,
        },
        {
          provide: DialogService,
          useValue: { open: openDialog, closeAll: closeAllDialog },
        },
        {
          provide: ConsoleShellStore,
          useValue: {
            activePanel: () => 'terminal',
            activeDialog: () => 'none',
            selectedFilePath: () => null,
            leftNavOpen: () => true,
            rightNavOpen: () => true,
            setActivePanel,
            toggleLeftNav: vi.fn(),
            toggleRightNav: vi.fn(),
            openDialog: openShellDialog,
            closeDialog,
            applyConnectedLayout,
            resetLayoutAfterDisconnect,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConsoleShellComponent);
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

  it('should call facade disconnect when onDisConnect is called', () => {
    disconnect.mockClear();
    component.onDisConnect();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('should switch pane when editor action is clicked', () => {
    component.onToolbarAction('editor');

    expect(closeDialog).toHaveBeenCalledTimes(1);
    expect(closeAllDialog).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(['editor'], {
      relativeTo: activatedRouteMock,
    });
  });

  it('should navigate to wifi when wifi action is clicked', () => {
    component.onToolbarAction('wifi');

    expect(closeDialog).toHaveBeenCalledTimes(1);
    expect(closeAllDialog).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(['wifi'], {
      relativeTo: activatedRouteMock,
    });
    expect(openShellDialog).not.toHaveBeenCalled();
    expect(openDialog).not.toHaveBeenCalled();
  });

  it('should sendCommand i2cdetect in terminal when i2c action is clicked', () => {
    component.onToolbarAction('i2c');

    expect(closeDialog).toHaveBeenCalledTimes(1);
    expect(closeAllDialog).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(['terminal'], {
      relativeTo: activatedRouteMock,
    });
    expect(sendCommand).toHaveBeenCalledWith('i2cdetect -y 1');
    expect(openShellDialog).not.toHaveBeenCalled();
    expect(openDialog).not.toHaveBeenCalled();
  });

  it('should set grid template columns with fixed diagram width when right nav is open', () => {
    expect(component.gridTemplateColumns()).toBe(
      '280px minmax(0, 1fr) calc(48px + 300px)',
    );
  });

  it('should apply connected layout when isConnected becomes true', () => {
    navigateSpy.mockClear();
    applyConnectedLayout.mockClear();
    vmSignal.set(vmDefaults({ isConnected: true }));
    TestBed.flushEffects();
    expect(applyConnectedLayout).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(['terminal'], {
      relativeTo: activatedRouteMock,
    });
  });

  it('should reset layout when isConnected becomes false after connected', () => {
    vmSignal.set(vmDefaults({ isConnected: true }));
    TestBed.flushEffects();
    navigateSpy.mockClear();
    resetLayoutAfterDisconnect.mockClear();
    vmSignal.set(vmDefaults({ isConnected: false }));
    TestBed.flushEffects();
    expect(resetLayoutAfterDisconnect).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(['terminal'], {
      relativeTo: activatedRouteMock,
    });
  });
});

describe('ConsoleShellComponent gridTemplateColumns when right nav closed', () => {
  let component: ConsoleShellComponent;
  let fixture: ComponentFixture<ConsoleShellComponent>;

  beforeEach(async () => {
    const { facade } = createConnectionFacadeMock(false);
    const activatedRoute = {
      firstChild: { snapshot: { url: [{ path: 'terminal' }] } },
    } as unknown as ActivatedRoute;

    await TestBed.configureTestingModule({
      imports: [ConsoleShellComponent],
      providers: [
        {
          provide: Router,
          useValue: {
            navigate: vi.fn().mockResolvedValue(true),
            events: EMPTY,
          },
        },
        { provide: ActivatedRoute, useValue: activatedRoute },
        { provide: SerialConnectionViewModelFacade, useValue: facade },
        {
          provide: DialogService,
          useValue: { open: vi.fn(), closeAll: vi.fn() },
        },
        {
          provide: ConsoleShellStore,
          useValue: {
            activePanel: () => 'terminal',
            activeDialog: () => 'none',
            selectedFilePath: () => null,
            leftNavOpen: () => true,
            rightNavOpen: () => false,
            setActivePanel: vi.fn(),
            toggleLeftNav: vi.fn(),
            toggleRightNav: vi.fn(),
            openDialog: vi.fn(),
            closeDialog: vi.fn(),
            applyConnectedLayout: vi.fn(),
            resetLayoutAfterDisconnect: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConsoleShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should set grid template columns with collapsed rail width when right nav is closed', () => {
    expect(component.gridTemplateColumns()).toBe('280px minmax(0, 1fr) 48px');
  });
});

describe('ConsoleShellComponent layout DOM (connected vs disconnected)', () => {
  let fixture: ComponentFixture<ConsoleShellComponent>;
  let vmSignal: ReturnType<typeof signal<SerialConnectionViewModel>>;
  let activatedRouteMock: ActivatedRoute;

  beforeEach(async () => {
    activatedRouteMock = {
      firstChild: { snapshot: { url: [{ path: 'terminal' }] } },
    } as unknown as ActivatedRoute;

    const { facade, vmSignal: vm } = createConnectionFacadeMock(false);
    vmSignal = vm;

    await TestBed.configureTestingModule({
      imports: [ConsoleShellComponent],
      providers: [
        {
          provide: Router,
          useValue: {
            navigate: vi.fn().mockResolvedValue(true),
            events: EMPTY,
          },
        },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        { provide: SerialConnectionViewModelFacade, useValue: facade },
        ConsoleShellStore,
        {
          provide: DialogService,
          useValue: { open: vi.fn(), closeAll: vi.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConsoleShellComponent);
    fixture.detectChanges();
  });

  it('shows connect page and hides three-pane shell and breadcrumb when disconnected', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('lib-connect-page')).toBeTruthy();
    expect(fixture.debugElement.query(By.css('lib-header-toolbar'))).toBeTruthy();
    expect(root.querySelector('lib-breadcrumb')).toBeNull();
    expect(root.querySelector('lib-left-sidebar')).toBeNull();
    expect(root.querySelector('router-outlet')).toBeNull();
  });

  it('shows toolbar, breadcrumb, three panes, and router outlet after connect', () => {
    vmSignal.set(vmDefaults({ isConnected: true }));
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('lib-connect-page')).toBeNull();
    expect(fixture.debugElement.query(By.css('lib-header-toolbar'))).toBeTruthy();
    expect(root.querySelector('lib-breadcrumb')).toBeTruthy();
    expect(root.querySelector('lib-left-sidebar')).toBeTruthy();
    expect(root.querySelector('router-outlet')).toBeTruthy();
    expect(root.querySelector('lib-right-sidebar')).toBeTruthy();
  });

  it('keeps right sidebar mounted when right nav is collapsed after connect', () => {
    vmSignal.set(vmDefaults({ isConnected: true }));
    fixture.detectChanges();

    const shellStore = TestBed.inject(ConsoleShellStore);
    shellStore.closeRightNav();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('lib-right-sidebar')).toBeTruthy();
    expect(root.querySelector('choh-pin-assign')).toBeNull();
  });

  it('resets active panel to terminal when connection becomes true', () => {
    const shellStore = TestBed.inject(ConsoleShellStore);
    shellStore.setActivePanel('editor');

    vmSignal.set(vmDefaults({ isConnected: true }));
    fixture.detectChanges();

    expect(shellStore.activePanel()).toBe('terminal');
  });
});
