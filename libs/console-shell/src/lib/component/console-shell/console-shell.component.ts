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
  SerialNotificationService,
} from '@libs-web-serial';
import { DialogService } from '@libs-dialogs';
import { filter, Subscription } from 'rxjs';
import { buildConsoleShellBreadcrumbSegments } from '../../functions';
import { ConsoleShellStore } from '../../service';

/** docked pane size band: wide (>=1280) vs compact (1024–1279). */
type DockedPaneWidthBand = 'wide' | 'compact';

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
  /** Left column width when the file tree is open (wide docked). */
  private static readonly LEFT_PANE_WIDTH_PX = 280;

  /** Left column width when the file tree is open (compact docked). */
  private static readonly LEFT_PANE_COMPACT_WIDTH_PX = 240;

  /** Narrow rail when the left file tree is collapsed (px); folder + toggle stay visible. */
  private static readonly LEFT_RAIL_COLLAPSED_WIDTH_PX = 48;

  /**
   * Pin diagram image width (px); grid track adds the chrome rail width on top.
   * Keep in sync with pin-assign `wallpaperS` max display width.
   */
  private static readonly RIGHT_PIN_DIAGRAM_WIDTH_PX = 300;

  /** Pin diagram width in compact docked layout (px). */
  private static readonly RIGHT_PIN_DIAGRAM_COMPACT_WIDTH_PX = 240;

  /** Narrow rail when the PIN panel is collapsed (px); keeps toggle + pin chrome visible. */
  private static readonly RIGHT_RAIL_COLLAPSED_WIDTH_PX = 48;

  /** Viewport max-width for overlay layout mode (issue #728). */
  private static readonly OVERLAY_BREAKPOINT = '(max-width: 1023.98px)';

  /** Viewport max-width for compact docked pane widths. */
  private static readonly COMPACT_DOCKED_BREAKPOINT = '(max-width: 1279.98px)';

  /** logout 完了待ちローダーの上限（失敗検知漏れの安全弁）。 */
  private static readonly LOGOUT_PENDING_TIMEOUT_MS = 30_000;

  private connectionVm = inject(SerialConnectionViewModelFacade);
  private shellReadiness = inject(PiZeroShellReadinessService);
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

  readonly activePanel = this.shellStore.activePanel;
  readonly leftNavOpen = this.shellStore.leftNavOpen;
  readonly rightNavOpen = this.shellStore.rightNavOpen;
  readonly layoutMode = this.shellStore.layoutMode;

  /** Wide vs compact in-flow pane widths while docked. */
  private readonly dockedPaneWidthBand =
    signal<DockedPaneWidthBand>('wide');

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
   * 3-column template: docked uses in-flow pane widths; overlay keeps rails only.
   */
  readonly gridTemplateColumns = computed(() => {
    const rail = ConsoleShellComponent.RIGHT_RAIL_COLLAPSED_WIDTH_PX;

    if (this.layoutMode() === 'overlay') {
      return `${rail}px minmax(0, 1fr) ${rail}px`;
    }

    const compact = this.dockedPaneWidthBand() === 'compact';
    const leftPane = compact
      ? ConsoleShellComponent.LEFT_PANE_COMPACT_WIDTH_PX
      : ConsoleShellComponent.LEFT_PANE_WIDTH_PX;
    const diagram = compact
      ? ConsoleShellComponent.RIGHT_PIN_DIAGRAM_COMPACT_WIDTH_PX
      : ConsoleShellComponent.RIGHT_PIN_DIAGRAM_WIDTH_PX;

    const left = this.leftNavOpen()
      ? `${leftPane}px`
      : `${ConsoleShellComponent.LEFT_RAIL_COLLAPSED_WIDTH_PX}px`;
    const right = this.rightNavOpen()
      ? `calc(${rail}px + ${diagram}px)`
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
        this.logoutDisconnectInFlight = true;
        this.notifications.notifyLogoutDetected();
        this.shellStore.closeDialog();
        this.dialogService.closeAll();
        this.connectionVm.disconnect();
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
        .observe([
          ConsoleShellComponent.OVERLAY_BREAKPOINT,
          ConsoleShellComponent.COMPACT_DOCKED_BREAKPOINT,
        ])
        .subscribe((state) => {
          const overlay =
            state.breakpoints[ConsoleShellComponent.OVERLAY_BREAKPOINT];
          this.shellStore.setLayoutMode(overlay ? 'overlay' : 'docked');
          this.dockedPaneWidthBand.set(
            state.breakpoints[
              ConsoleShellComponent.COMPACT_DOCKED_BREAKPOINT
            ]
              ? 'compact'
              : 'wide',
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
    this.subscriptions.unsubscribe();
  }

  private clearLogoutPendingTimeout(): void {
    if (this.logoutPendingTimeoutId !== null) {
      clearTimeout(this.logoutPendingTimeoutId);
      this.logoutPendingTimeoutId = null;
    }
  }

  onConnect() {
    this.connectionVm.connect();
  }

  onDisConnect() {
    this.connectionVm.disconnect();
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

  /** Navigate File Manager to a breadcrumb directory segment (issue #727). */
  onBreadcrumbNavigate(path: string): void {
    this.shellStore.setFileManagerCurrentPath(path);
    this.shellStore.setSelectedFilePath(null);
  }

  onToolbarAction(action: ToolbarAction): void {
    if (this.logoutPending()) {
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
