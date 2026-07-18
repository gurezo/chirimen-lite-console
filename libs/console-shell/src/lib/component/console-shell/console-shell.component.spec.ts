import { ComponentFixture, TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { ActivatedRoute, Router } from '@angular/router';
import {
  PiZeroShellReadinessService,
  SerialConnectionViewModelFacade,
  SerialNotificationService,
  type SerialConnectionViewModel,
} from '@libs-web-serial';
import { DialogService } from '@libs-dialogs';
import { ConsoleShellStore } from '../../service';
import { BehaviorSubject, EMPTY, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleShellComponent } from './console-shell.component';

const OVERLAY_BP = '(max-width: 1023.98px)';
const COMPACT_BP = '(max-width: 1279.98px)';

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

function createShellReadinessMock(initialEpoch = 0) {
  const logoutCompletedEpochSignal = signal(initialEpoch);
  const logoutPendingSignal = signal(false);
  return {
    logoutCompletedEpoch: logoutCompletedEpochSignal.asReadonly(),
    logoutCompletedEpochSignal,
    logoutPending: logoutPendingSignal.asReadonly(),
    logoutPendingSignal,
    clearLogoutPending: vi.fn(() => logoutPendingSignal.set(false)),
    beginLogoutPending: vi.fn(() => logoutPendingSignal.set(true)),
  };
}

function createBreakpointObserverMock(
  initial: { overlay?: boolean; compact?: boolean } = {},
) {
  const overlay = initial.overlay ?? false;
  const compact = initial.compact ?? false;
  const state$ = new BehaviorSubject<BreakpointState>({
    matches: overlay || compact,
    breakpoints: {
      [OVERLAY_BP]: overlay,
      [COMPACT_BP]: compact,
    },
  });

  return {
    state$,
    provider: {
      provide: BreakpointObserver,
      useValue: {
        observe: () => state$.asObservable(),
      },
    },
    emit(next: { overlay?: boolean; compact?: boolean }) {
      const nextOverlay = next.overlay ?? false;
      const nextCompact = next.compact ?? false;
      state$.next({
        matches: nextOverlay || nextCompact,
        breakpoints: {
          [OVERLAY_BP]: nextOverlay,
          [COMPACT_BP]: nextCompact,
        },
      });
    },
  };
}

function baseStoreMock(overrides: Record<string, unknown> = {}) {
  return {
    activePanel: () => 'terminal',
    activeDialog: () => 'none',
    selectedFilePath: () => null,
    fileManagerCurrentPath: () => '.',
    leftNavOpen: () => true,
    rightNavOpen: () => true,
    layoutMode: () => 'docked' as const,
    leftPaneWidthPx: () => 280,
    rightDiagramWidthPx: () => 300,
    setActivePanel: vi.fn(),
    toggleLeftNav: vi.fn(),
    toggleRightNav: vi.fn(),
    closeLeftNav: vi.fn(),
    closeRightNav: vi.fn(),
    setLayoutMode: vi.fn(),
    setLeftPaneWidth: vi.fn(),
    setRightDiagramWidth: vi.fn(),
    syncDockedPaneWidthsForBand: vi.fn(),
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    applyConnectedLayout: vi.fn(),
    resetLayoutAfterDisconnect: vi.fn(),
    setFileManagerCurrentPath: vi.fn(),
    setSelectedFilePath: vi.fn(),
    ...overrides,
  };
}

describe('ConsoleShellComponent', () => {
  let component: ConsoleShellComponent;
  let fixture: ComponentFixture<ConsoleShellComponent>;
  let connect: ReturnType<typeof vi.fn>;
  let disconnect: ReturnType<typeof vi.fn>;
  let sendCommand: ReturnType<typeof vi.fn>;
  let vmSignal: ReturnType<typeof signal<SerialConnectionViewModel>>;
  let logoutCompletedEpochSignal: ReturnType<typeof signal<number>>;
  let logoutPendingSignal: ReturnType<typeof signal<boolean>>;
  let openDialog: ReturnType<typeof vi.fn>;
  let closeAllDialog: ReturnType<typeof vi.fn>;
  let setActivePanel: ReturnType<typeof vi.fn>;
  let closeDialog: ReturnType<typeof vi.fn>;
  let openShellDialog: ReturnType<typeof vi.fn>;
  let applyConnectedLayout: ReturnType<typeof vi.fn>;
  let resetLayoutAfterDisconnect: ReturnType<typeof vi.fn>;
  let notifyLogoutDetected: ReturnType<typeof vi.fn>;
  let notifyLogoutCancelled: ReturnType<typeof vi.fn>;
  let navigateSpy: ReturnType<typeof vi.fn>;
  let activatedRouteMock: ActivatedRoute;

  beforeEach(async () => {
    navigateSpy = vi.fn().mockResolvedValue(true);
    activatedRouteMock = {
      firstChild: { snapshot: { url: [{ path: 'terminal' }] } },
    } as unknown as ActivatedRoute;

    const { facade, vmSignal: vm } = createConnectionFacadeMock(false);
    const shellReadiness = createShellReadinessMock();
    vmSignal = vm;
    logoutCompletedEpochSignal = shellReadiness.logoutCompletedEpochSignal;
    logoutPendingSignal = shellReadiness.logoutPendingSignal;
    connect = facade.connect;
    disconnect = facade.disconnect;
    sendCommand = facade.sendCommand;
    applyConnectedLayout = vi.fn();
    resetLayoutAfterDisconnect = vi.fn();
    notifyLogoutDetected = vi.fn();
    notifyLogoutCancelled = vi.fn();

    openDialog = vi.fn().mockReturnValue({ closed: of(undefined) });
    closeAllDialog = vi.fn();
    setActivePanel = vi.fn();
    closeDialog = vi.fn();
    openShellDialog = vi.fn();

    const breakpoints = createBreakpointObserverMock();

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
          provide: PiZeroShellReadinessService,
          useValue: shellReadiness,
        },
        {
          provide: SerialNotificationService,
          useValue: { notifyLogoutDetected, notifyLogoutCancelled },
        },
        {
          provide: DialogService,
          useValue: { open: openDialog, closeAll: closeAllDialog },
        },
        breakpoints.provider,
        {
          provide: ConsoleShellStore,
          useValue: baseStoreMock({
            setActivePanel,
            openDialog: openShellDialog,
            closeDialog,
            applyConnectedLayout,
            resetLayoutAfterDisconnect,
          }),
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

  it('closes dialogs and disconnects once when logout completes while connected', () => {
    vmSignal.set(vmDefaults({ isConnected: true }));
    TestBed.flushEffects();
    disconnect.mockClear();
    closeDialog.mockClear();
    closeAllDialog.mockClear();
    notifyLogoutDetected.mockClear();

    logoutCompletedEpochSignal.set(1);
    TestBed.flushEffects();

    expect(notifyLogoutDetected).toHaveBeenCalledTimes(1);
    expect(closeDialog).toHaveBeenCalledTimes(1);
    expect(closeAllDialog).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);

    logoutCompletedEpochSignal.set(1);
    TestBed.flushEffects();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(notifyLogoutDetected).toHaveBeenCalledTimes(1);
  });

  it('does not disconnect again for the same logout epoch while disconnect is in flight', () => {
    vmSignal.set(vmDefaults({ isConnected: true }));
    TestBed.flushEffects();
    disconnect.mockClear();

    logoutCompletedEpochSignal.set(1);
    TestBed.flushEffects();
    expect(disconnect).toHaveBeenCalledTimes(1);

    logoutCompletedEpochSignal.set(1);
    TestBed.flushEffects();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not disconnect on logout when already disconnected', () => {
    disconnect.mockClear();
    logoutCompletedEpochSignal.set(1);
    TestBed.flushEffects();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('shows a blocking logout loader while logoutPending is true', () => {
    vmSignal.set(vmDefaults({ isConnected: true }));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[aria-label="ログアウト処理中"]'),
    ).toBeNull();

    logoutPendingSignal.set(true);
    fixture.detectChanges();

    const overlay = fixture.nativeElement.querySelector(
      '[aria-label="ログアウト処理中"]',
    ) as HTMLElement | null;
    expect(overlay).toBeTruthy();
    expect(overlay?.textContent).toContain('ログアウト処理中');
    expect(fixture.nativeElement.querySelector('mat-progress-spinner')).toBeTruthy();
  });

  it('blocks toolbar actions while logoutPending is true', () => {
    vmSignal.set(vmDefaults({ isConnected: true }));
    TestBed.flushEffects();
    logoutPendingSignal.set(true);
    TestBed.flushEffects();
    navigateSpy.mockClear();

    component.onToolbarAction('editor');

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('notifies cancelled when logoutPending clears while still connected', () => {
    vmSignal.set(vmDefaults({ isConnected: true }));
    TestBed.flushEffects();
    notifyLogoutCancelled.mockClear();

    logoutPendingSignal.set(true);
    TestBed.flushEffects();
    logoutPendingSignal.set(false);
    TestBed.flushEffects();

    expect(notifyLogoutCancelled).toHaveBeenCalledWith('failed');
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
          provide: PiZeroShellReadinessService,
          useValue: createShellReadinessMock(),
        },
        {
          provide: SerialNotificationService,
          useValue: {
            notifyLogoutDetected: vi.fn(),
            notifyLogoutCancelled: vi.fn(),
          },
        },
        {
          provide: DialogService,
          useValue: { open: vi.fn(), closeAll: vi.fn() },
        },
        createBreakpointObserverMock().provider,
        {
          provide: ConsoleShellStore,
          useValue: baseStoreMock({
            rightNavOpen: () => false,
          }),
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

describe('ConsoleShellComponent responsive layout', () => {
  let component: ConsoleShellComponent;
  let fixture: ComponentFixture<ConsoleShellComponent>;
  let setLayoutMode: ReturnType<typeof vi.fn>;
  let closeLeftNav: ReturnType<typeof vi.fn>;
  let closeRightNav: ReturnType<typeof vi.fn>;
  let setLeftPaneWidth: ReturnType<typeof vi.fn>;
  let setRightDiagramWidth: ReturnType<typeof vi.fn>;
  let syncDockedPaneWidthsForBand: ReturnType<typeof vi.fn>;
  let breakpoints: ReturnType<typeof createBreakpointObserverMock>;
  let layoutModeSignal: ReturnType<typeof signal<'docked' | 'overlay'>>;
  let leftNavOpenSignal: ReturnType<typeof signal<boolean>>;
  let rightNavOpenSignal: ReturnType<typeof signal<boolean>>;
  let leftPaneWidthSignal: ReturnType<typeof signal<number>>;
  let rightDiagramWidthSignal: ReturnType<typeof signal<number>>;

  beforeEach(async () => {
    const { facade } = createConnectionFacadeMock(true);
    layoutModeSignal = signal<'docked' | 'overlay'>('docked');
    leftNavOpenSignal = signal(true);
    rightNavOpenSignal = signal(true);
    leftPaneWidthSignal = signal(280);
    rightDiagramWidthSignal = signal(300);
    setLayoutMode = vi.fn((mode: 'docked' | 'overlay') => {
      layoutModeSignal.set(mode);
      if (mode === 'overlay') {
        leftNavOpenSignal.set(false);
        rightNavOpenSignal.set(false);
      } else {
        leftNavOpenSignal.set(true);
        rightNavOpenSignal.set(true);
      }
    });
    closeLeftNav = vi.fn(() => leftNavOpenSignal.set(false));
    closeRightNav = vi.fn(() => rightNavOpenSignal.set(false));
    setLeftPaneWidth = vi.fn((width: number) => leftPaneWidthSignal.set(width));
    setRightDiagramWidth = vi.fn((width: number) =>
      rightDiagramWidthSignal.set(width),
    );
    syncDockedPaneWidthsForBand = vi.fn((band: 'wide' | 'compact') => {
      if (band === 'compact') {
        leftPaneWidthSignal.set(240);
        rightDiagramWidthSignal.set(240);
      } else {
        leftPaneWidthSignal.set(280);
        rightDiagramWidthSignal.set(300);
      }
    });
    breakpoints = createBreakpointObserverMock();

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
          provide: PiZeroShellReadinessService,
          useValue: createShellReadinessMock(),
        },
        {
          provide: SerialNotificationService,
          useValue: {
            notifyLogoutDetected: vi.fn(),
            notifyLogoutCancelled: vi.fn(),
          },
        },
        {
          provide: DialogService,
          useValue: { open: vi.fn(), closeAll: vi.fn() },
        },
        breakpoints.provider,
        {
          provide: ConsoleShellStore,
          useValue: baseStoreMock({
            layoutMode: () => layoutModeSignal(),
            leftNavOpen: () => leftNavOpenSignal(),
            rightNavOpen: () => rightNavOpenSignal(),
            leftPaneWidthPx: () => leftPaneWidthSignal(),
            rightDiagramWidthPx: () => rightDiagramWidthSignal(),
            setLayoutMode,
            closeLeftNav,
            closeRightNav,
            setLeftPaneWidth,
            setRightDiagramWidth,
            syncDockedPaneWidthsForBand,
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConsoleShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('uses rail-only grid columns in overlay mode', () => {
    layoutModeSignal.set('overlay');
    leftNavOpenSignal.set(false);
    rightNavOpenSignal.set(false);
    fixture.detectChanges();

    expect(component.gridTemplateColumns()).toBe(
      '48px minmax(0, 1fr) 48px',
    );
  });

  it('uses compact pane widths when compact docked breakpoint matches', () => {
    breakpoints.emit({ overlay: false, compact: true });
    fixture.detectChanges();

    expect(setLayoutMode).toHaveBeenCalledWith('docked');
    expect(syncDockedPaneWidthsForBand).toHaveBeenCalledWith('compact');
    expect(component.gridTemplateColumns()).toBe(
      '240px minmax(0, 1fr) calc(48px + 240px)',
    );
  });

  it('calls setLayoutMode(overlay) when overlay breakpoint matches', () => {
    setLayoutMode.mockClear();
    breakpoints.emit({ overlay: true, compact: true });
    fixture.detectChanges();

    expect(setLayoutMode).toHaveBeenCalledWith('overlay');
  });

  it('shows overlay backdrop when a side pane is open in overlay mode', () => {
    layoutModeSignal.set('overlay');
    leftNavOpenSignal.set(true);
    rightNavOpenSignal.set(false);
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector(
      '[aria-label="Close side panels"]',
    ) as HTMLElement | null;
    expect(backdrop).toBeTruthy();
  });

  it('closes both panes when overlay backdrop is clicked', () => {
    layoutModeSignal.set('overlay');
    leftNavOpenSignal.set(true);
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector(
      '[aria-label="Close side panels"]',
    ) as HTMLButtonElement;
    backdrop.click();

    expect(closeLeftNav).toHaveBeenCalledTimes(1);
    expect(closeRightNav).toHaveBeenCalledTimes(1);
  });

  it('hides overlay backdrop when both panes are closed', () => {
    layoutModeSignal.set('overlay');
    leftNavOpenSignal.set(false);
    rightNavOpenSignal.set(false);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[aria-label="Close side panels"]'),
    ).toBeNull();
  });

  it('resizes left pane width while dragging the left separator', () => {
    const handle = fixture.nativeElement.querySelector(
      '[aria-label="Resize left panel"]',
    ) as HTMLElement;
    expect(handle).toBeTruthy();

    handle.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 280, bubbles: true }),
    );
    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 320, bubbles: true }),
    );
    window.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 320, bubbles: true }),
    );

    expect(setLeftPaneWidth).toHaveBeenCalledWith(320);
    expect(component.gridTemplateColumns()).toBe(
      '320px minmax(0, 1fr) calc(48px + 300px)',
    );
  });

  it('resizes right diagram width while dragging the right separator', () => {
    const handle = fixture.nativeElement.querySelector(
      '[aria-label="Resize right panel"]',
    ) as HTMLElement;
    expect(handle).toBeTruthy();

    handle.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 900, bubbles: true }),
    );
    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 860, bubbles: true }),
    );
    window.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 860, bubbles: true }),
    );

    expect(setRightDiagramWidth).toHaveBeenCalledWith(340);
    expect(component.gridTemplateColumns()).toBe(
      '280px minmax(0, 1fr) calc(48px + 340px)',
    );
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
        {
          provide: PiZeroShellReadinessService,
          useValue: createShellReadinessMock(),
        },
        {
          provide: SerialNotificationService,
          useValue: {
            notifyLogoutDetected: vi.fn(),
            notifyLogoutCancelled: vi.fn(),
          },
        },
        ConsoleShellStore,
        createBreakpointObserverMock().provider,
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
