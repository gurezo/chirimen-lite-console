import {
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  OnInit,
  Type,
  untracked,
} from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
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
} from '@libs-web-serial';
import { DialogService } from '@libs-dialogs';
import { filter, Subscription } from 'rxjs';
import { buildConsoleShellBreadcrumbSegments } from '../../functions';
import { ConsoleShellStore } from '../../service';

@Component({
  selector: 'lib-console-shell',
  imports: [
    ActionToolBarComponent,
    BreadcrumbComponent,
    ConnectPageComponent,
    HeaderToolbarComponent,
    LeftSidebarComponent,
    RightSidebarComponent,
    RouterOutlet,
  ],
  templateUrl: './console-shell.component.html',
})
export class ConsoleShellComponent implements OnInit, OnDestroy {
  /** Left column width when the file tree is open: tree + chrome rail (px). */
  private static readonly LEFT_PANE_WIDTH_PX = 280;

  /** Narrow rail when the left file tree is collapsed (px); folder + toggle stay visible. */
  private static readonly LEFT_RAIL_COLLAPSED_WIDTH_PX = 48;

  /**
   * Pin diagram image width (px); grid track adds the left chrome rail width on top.
   * Keep in sync with pin-assign `wallpaperS` display width.
   */
  private static readonly RIGHT_PIN_DIAGRAM_WIDTH_PX = 300;

  /** Narrow rail when the PIN panel is collapsed (px); keeps toggle + pin chrome visible. */
  private static readonly RIGHT_RAIL_COLLAPSED_WIDTH_PX = 48;

  private connectionVm = inject(SerialConnectionViewModelFacade);
  private shellReadiness = inject(PiZeroShellReadinessService);
  private shellStore = inject(ConsoleShellStore);
  private dialogService = inject(DialogService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /** Web Serial の接続可否（単一ビューモデル {@link SerialConnectionViewModelFacade#vm} を参照）。 */
  readonly connected = computed(() => this.connectionVm.vm().isConnected);

  readonly activePanel = this.shellStore.activePanel;
  readonly leftNavOpen = this.shellStore.leftNavOpen;
  readonly rightNavOpen = this.shellStore.rightNavOpen;

  readonly breadcrumbSegments = computed(() =>
    buildConsoleShellBreadcrumbSegments({
      activePanel: this.shellStore.activePanel(),
      activeDialog: this.shellStore.activeDialog(),
      selectedFilePath: this.shellStore.selectedFilePath(),
    }),
  );

  /**
   * Stable 3-column template: fixed left, flexible center, fixed right track.
   * Left: full pane or narrow rail; right: rail + pin diagram or narrow rail.
   */
  readonly gridTemplateColumns = computed(() => {
    const left = this.leftNavOpen()
      ? `${ConsoleShellComponent.LEFT_PANE_WIDTH_PX}px`
      : `${ConsoleShellComponent.LEFT_RAIL_COLLAPSED_WIDTH_PX}px`;
    const rail = ConsoleShellComponent.RIGHT_RAIL_COLLAPSED_WIDTH_PX;
    const diagram = ConsoleShellComponent.RIGHT_PIN_DIAGRAM_WIDTH_PX;
    const right = this.rightNavOpen()
      ? `calc(${rail}px + ${diagram}px)`
      : `${rail}px`;
    return `${left} minmax(0, 1fr) ${right}`;
  });

  private subscriptions = new Subscription();
  private lastConnected = false;
  private lastLogoutCompletedEpoch = 0;
  private logoutDisconnectInFlight = false;

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
        this.shellStore.closeDialog();
        this.dialogService.closeAll();
        this.connectionVm.disconnect();
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
    this.subscriptions.unsubscribe();
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

  onToolbarAction(action: ToolbarAction): void {
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
