import {
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
  Type,
  untracked,
} from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { ConnectPageComponent } from '@libs-connect';
import {
  ActionToolBarComponent,
  ToolbarAction,
} from '../action-tool-bar/action-tool-bar.component';
import { BreadcrumbComponent } from '../breadcrumb/breadcrumb.component';
import { HeaderToolbarComponent } from '../header-toolbar/header-toolbar.component';
import { LeftSidebarComponent } from '../left-sidebar/left-sidebar.component';
import { RightSidebarComponent } from '../right-sidebar/right-sidebar.component';
import { SetupPageComponent } from '@libs-chirimen-setup';
import { RemotePageComponent } from '@libs-remote';
import {
  PiZeroShellReadinessService,
  SerialConnectionViewModelFacade,
  SerialExpectedDisconnectService,
  SerialNotificationService,
} from '@libs-web-serial';
import { DialogService } from '@libs-dialogs';
import { filter, Subscription } from 'rxjs';
import { buildConsoleShellBreadcrumbSegments } from '../../functions';
import { ConsoleShellStore, RAIL_WIDTH_PX } from '../../service';

@Component({
  selector: 'lib-console-shell',
  imports: [
    ActionToolBarComponent,
    BreadcrumbComponent,
    ConnectPageComponent,
    HeaderToolbarComponent,
    LeftSidebarComponent,
    MatProgressSpinner,
    RightSidebarComponent,
    RouterOutlet,
  ],
  templateUrl: './console-shell.component.html',
})
export class ConsoleShellComponent implements OnInit, OnDestroy {
  /** Viewport max-width for overlay layout mode (issue #728). */
  private static readonly OVERLAY_BREAKPOINT = '(max-width: 1023.98px)';

  /** logout 完了待ちローダーの上限（失敗検知漏れの安全弁）。 */
  private static readonly LOGOUT_PENDING_TIMEOUT_MS = 30_000;

  private connectionVm = inject(SerialConnectionViewModelFacade);
  private shellReadiness = inject(PiZeroShellReadinessService);
  private expectedDisconnect = inject(SerialExpectedDisconnectService);
  private notifications = inject(SerialNotificationService);
  private shellStore = inject(ConsoleShellStore);
  private dialogService = inject(DialogService);
  private breakpointObserver = inject(BreakpointObserver);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /** Web Serial の接続可否（単一ビューモデル {@link SerialConnectionViewModelFacade#vm} を参照）。 */
  readonly connected = computed(() => this.connectionVm.vm().isConnected);

  /** logout / exit 送信後〜切断完了までの入力ブロック用ローダー。 */
  readonly logoutPending = this.shellReadiness.logoutPending;

  /**
   * デバイス再起動コマンド〜切断クリーンアップ完了までの入力ブロック用ローダー（#754）。
   */
  readonly rebootPending = this.expectedDisconnect.rebootPending;

  /**
   * Web Serial 接続〜シェル準備完了までの入力ブロック用ローダー（issue #755）。
   * 初期化失敗時（`setupStatus === 'failed'`）は解除して再操作を許可する。
   */
  readonly connectionBusy = computed(() => {
    const vm = this.connectionVm.vm();
    return (
      vm.isConnecting ||
      (vm.isConnected && !vm.isLoggedIn && vm.setupStatus !== 'failed')
    );
  });

  readonly activePanel = this.shellStore.activePanel;
  readonly leftNavOpen = this.shellStore.leftNavOpen;
  readonly rightNavOpen = this.shellStore.rightNavOpen;
  readonly layoutMode = this.shellStore.layoutMode;
  readonly leftPaneWidthPx = this.shellStore.leftPaneWidthPx;
  readonly rightDiagramWidthPx = this.shellStore.rightDiagramWidthPx;

  /** True while a pane resize drag is active (blocks text selection). */
  readonly isResizingPane = signal(false);

  readonly breadcrumbSegments = computed(() =>
    buildConsoleShellBreadcrumbSegments({
      activePanel: this.shellStore.activePanel(),
      activeDialog: this.shellStore.activeDialog(),
      selectedFilePath: this.shellStore.selectedFilePath(),
      fileManagerCurrentPath: this.shellStore.fileManagerCurrentPath(),
    }),
  );

  /** True when overlay mode has at least one side pane open (backdrop). */
  readonly showOverlayBackdrop = computed(
    () =>
      this.layoutMode() === 'overlay' &&
      (this.leftNavOpen() || this.rightNavOpen()),
  );

  /**
   * Overlay keeps fixed rails; docked open panes use store-backed widths
   * updated by drag handles.
   */
  readonly gridTemplateColumns = computed(() => {
    const rail = RAIL_WIDTH_PX;

    if (this.layoutMode() === 'overlay') {
      return `${rail}px minmax(0, 1fr) ${rail}px`;
    }

    const left = this.leftNavOpen()
      ? `${this.leftPaneWidthPx()}px`
      : `${rail}px`;
    const right = this.rightNavOpen()
      ? `calc(${rail}px + ${this.rightDiagramWidthPx()}px)`
      : `${rail}px`;
    return `${left} minmax(0, 1fr) ${right}`;
  });

  private subscriptions = new Subscription();
  private lastConnected = false;
  private lastLogoutCompletedEpoch = 0;
  private logoutDisconnectInFlight = false;
  private lastLogoutPending = false;
  private logoutPendingTimedOut = false;
  private logoutPendingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private paneResizeCleanup: (() => void) | null = null;

  constructor() {
    effect(() => {
      const next = this.connectionVm.vm().isConnected;
      const prev = this.lastConnected;
      if (prev === next) {
        return;
      }
      this.lastConnected = next;
      untracked(() => {
        if (!prev && next) {
          this.shellStore.applyConnectedLayout();
          void this.router.navigate(['terminal'], { relativeTo: this.route });
        } else if (prev && !next) {
          this.logoutDisconnectInFlight = false;
          this.clearLogoutPendingTimeout();
          this.shellStore.resetLayoutAfterDisconnect();
          void this.router.navigate(['terminal'], { relativeTo: this.route });
        }
      });
    });

    effect(() => {
      const logoutEpoch = this.shellReadiness.logoutCompletedEpoch();
      if (
        logoutEpoch <= 0 ||
        logoutEpoch === this.lastLogoutCompletedEpoch ||
        this.logoutDisconnectInFlight ||
        !this.connectionVm.vm().isConnected
      ) {
        return;
      }
      this.lastLogoutCompletedEpoch = logoutEpoch;
      untracked(() => {
        this.endSessionAndReturnToConnect('logout');
      });
    });

    effect(() => {
      const pending = this.shellReadiness.logoutPending();
      const wasPending = this.lastLogoutPending;
      this.lastLogoutPending = pending;
      untracked(() => {
        this.clearLogoutPendingTimeout();
        if (!pending) {
          if (
            wasPending &&
            this.connectionVm.vm().isConnected &&
            !this.logoutDisconnectInFlight &&
            !this.logoutPendingTimedOut
          ) {
            // 切断前に pending が消えた = logout 失敗でシェルへ戻った
            this.notifications.notifyLogoutCancelled('failed');
          }
          this.logoutPendingTimedOut = false;
          return;
        }
        this.logoutPendingTimeoutId = setTimeout(() => {
          if (!this.shellReadiness.logoutPending()) {
            return;
          }
          this.logoutPendingTimedOut = true;
          this.shellReadiness.clearLogoutPending();
          this.notifications.notifyLogoutCancelled('timeout');
        }, ConsoleShellComponent.LOGOUT_PENDING_TIMEOUT_MS);
      });
    });
  }

  ngOnInit() {
    this.subscriptions.add(
      this.router.events
        .pipe(
          filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        )
        .subscribe(() => this.syncActivePanelFromRouter()),
    );

    this.subscriptions.add(
      this.breakpointObserver
        .observe([ConsoleShellComponent.OVERLAY_BREAKPOINT])
        .subscribe((state) => {
          this.shellStore.setLayoutMode(
            state.matches ? 'overlay' : 'docked',
          );
        }),
    );
  }

  private syncActivePanelFromRouter(): void {
    const path = this.route.firstChild?.snapshot.url[0]?.path;
    if (
      path === 'terminal' ||
      path === 'editor' ||
      path === 'example' ||
      path === 'wifi'
    ) {
      this.shellStore.setActivePanel(path);
    }
  }

  ngOnDestroy() {
    this.clearLogoutPendingTimeout();
    this.stopPaneResize();
    this.subscriptions.unsubscribe();
  }

  private clearLogoutPendingTimeout(): void {
    if (this.logoutPendingTimeoutId !== null) {
      clearTimeout(this.logoutPendingTimeoutId);
      this.logoutPendingTimeoutId = null;
    }
  }

  /**
   * ログアウト検出・手動 DisConnect 共通のセッション終了（#725 / #753）。
   * ダイアログを閉じたうえで Web Serial を切断し、未接続 UI へ戻す。
   */
  private endSessionAndReturnToConnect(
    reason: 'logout' | 'manual-disconnect',
  ): void {
    this.logoutDisconnectInFlight = true;
    if (reason === 'logout') {
      this.notifications.notifyLogoutDetected();
    } else {
      this.notifications.notifyManualDisconnect();
    }
    this.shellStore.closeDialog();
    this.dialogService.closeAll();
    this.connectionVm.disconnect();
  }

  onConnect() {
    this.connectionVm.connect();
  }

  onDisConnect() {
    if (
      this.logoutDisconnectInFlight ||
      this.logoutPending() ||
      this.rebootPending() ||
      this.connectionBusy() ||
      !this.connectionVm.vm().isConnected
    ) {
      return;
    }
    this.endSessionAndReturnToConnect('manual-disconnect');
  }

  onToggleLeftSidebar() {
    this.shellStore.toggleLeftNav();
  }

  onToggleRightSidebar() {
    this.shellStore.toggleRightNav();
  }

  /** Close both side panes (overlay backdrop click). */
  onCloseOverlayPanels(): void {
    this.shellStore.closeLeftNav();
    this.shellStore.closeRightNav();
  }

  onLeftPaneResizeStart(event: PointerEvent): void {
    this.startPaneResize(event, 'left');
  }

  onRightPaneResizeStart(event: PointerEvent): void {
    this.startPaneResize(event, 'right');
  }

  private startPaneResize(
    event: PointerEvent,
    side: 'left' | 'right',
  ): void {
    event.preventDefault();
    event.stopPropagation();
    this.stopPaneResize();

    const startX = event.clientX;
    const startWidth =
      side === 'left'
        ? this.shellStore.leftPaneWidthPx()
        : this.shellStore.rightDiagramWidthPx();

    this.isResizingPane.set(true);

    const onMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      if (side === 'left') {
        this.shellStore.setLeftPaneWidth(startWidth + delta);
      } else {
        this.shellStore.setRightDiagramWidth(startWidth - delta);
      }
    };

    const onUp = () => this.stopPaneResize();

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    this.paneResizeCleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      this.isResizingPane.set(false);
      this.paneResizeCleanup = null;
    };
  }

  private stopPaneResize(): void {
    this.paneResizeCleanup?.();
  }

  /** Navigate File Manager to a breadcrumb directory segment (issue #727). */
  onBreadcrumbNavigate(path: string): void {
    this.shellStore.setFileManagerCurrentPath(path);
    this.shellStore.setSelectedFilePath(null);
  }

  onToolbarAction(action: ToolbarAction): void {
    if (this.logoutPending() || this.rebootPending() || this.connectionBusy()) {
      return;
    }

    if (
      action === 'terminal' ||
      action === 'editor' ||
      action === 'example' ||
      action === 'wifi'
    ) {
      this.shellStore.closeDialog();
      this.dialogService.closeAll();
      void this.router.navigate([action], { relativeTo: this.route });
      return;
    }

    if (action === 'i2c') {
      this.shellStore.closeDialog();
      this.dialogService.closeAll();
      void this.router.navigate(['terminal'], { relativeTo: this.route });
      this.connectionVm.sendCommand('i2cdetect -y 1');
      return;
    }

    this.shellStore.openDialog(action);
    const componentMap = {
      setup: SetupPageComponent,
      remote: RemotePageComponent,
    } as const;

    const component = componentMap[action];
    const dialogRef = this.dialogService.open(component as Type<unknown>, {
      width: '80vw',
      height: '80vh',
      disableClose: true,
    });

    this.subscriptions.add(
      dialogRef.closed.subscribe(() => {
        this.shellStore.closeDialog();
      }),
    );
  }
}
