import { AsyncPipe } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  Type,
} from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { ConnectPageComponent } from '@libs-connect-feature';
import {
  ActionToolBarComponent,
  BreadcrumbComponent,
  HeaderToolbarComponent,
  LeftSidebarComponent,
  RightSidebarComponent,
  ToolbarAction,
} from '@libs-console-shell-ui';
import { SetupPageComponent } from '@libs-chirimen-setup-feature';
import { RemotePageComponent } from '@libs-remote-feature';
import {
  SerialFacadeService,
  SerialNotificationService,
} from '@libs-web-serial-data-access';
import { DialogService } from '@libs-dialogs-util';
import { filter, pairwise, startWith, Subscription, take } from 'rxjs';
import {
  buildConsoleShellBreadcrumbSegments,
  ConsoleShellStore,
} from '@libs-console-shell-util';
import { TerminalCommandRequestService } from '@libs-terminal-util';

@Component({
  selector: 'lib-console-shell',
  imports: [
    ActionToolBarComponent,
    AsyncPipe,
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

  private serial = inject(SerialFacadeService);
  private serialNotification = inject(SerialNotificationService);
  private shellStore = inject(ConsoleShellStore);
  private dialogService = inject(DialogService);
  private terminalCommands = inject(TerminalCommandRequestService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /** Web Serial 接続状態（`@gurezo/web-serial-rxjs` の isConnected$ 経由） */
  connected$ = this.serial.isConnected$;

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

  ngOnInit() {
    this.subscriptions.add(
      this.router.events
        .pipe(
          filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        )
        .subscribe(() => this.syncActivePanelFromRouter()),
    );

    this.subscriptions.add(
      this.serial.isConnected$
        .pipe(
          startWith(false),
          pairwise(),
          filter(([prev, next]) => prev !== next),
        )
        .subscribe(([prev, next]) => {
          if (!prev && next) {
            this.shellStore.applyConnectedLayout();
            void this.router.navigate(['terminal'], { relativeTo: this.route });
          } else if (prev && !next) {
            this.shellStore.resetLayoutAfterDisconnect();
            void this.router.navigate(['terminal'], { relativeTo: this.route });
          }
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
    this.subscriptions.unsubscribe();
  }

  onConnect() {
    this.serial
      .connect$()
      .pipe(take(1))
      .subscribe((result) => {
        if (result.ok) {
          this.serialNotification.notifyConnectionSuccess();
        } else {
          this.serialNotification.notifyConnectionError(result.errorMessage);
        }
      });
  }

  onDisConnect() {
    this.serial
      .disconnect$()
      .pipe(take(1))
      .subscribe({
        error: (err: unknown) => console.error('Disconnect error', err),
      });
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
      this.terminalCommands.requestCommand('i2cdetect -y 1');
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
