import { computed, Injectable, signal } from '@angular/core';

type ConsoleShellPanel = 'terminal' | 'editor' | 'example' | 'wifi';
type ConsoleShellDialog = 'none' | 'setup' | 'remote';

/** docked: in-flow side panes; overlay: rails only in-flow, panes float over center. */
export type ConsoleShellLayoutMode = 'docked' | 'overlay';

/** Left column width (tree + rail) default and minimum (px). No upper bound. */
export const LEFT_PANE_WIDTH = {
  default: 280,
  min: 180,
} as const;

/** Right pin-diagram track width (excludes chrome rail) default and minimum (px). No upper bound. */
export const RIGHT_DIAGRAM_WIDTH = {
  default: 300,
  min: 160,
} as const;

export const RAIL_WIDTH_PX = 48;

export interface ConsoleShellState {
  activePanel: ConsoleShellPanel;
  leftNavOpen: boolean;
  rightNavOpen: boolean;
  selectedFilePath: string | null;
  /** Current File Manager directory path (e.g. `.` or `./home/pi`). */
  fileManagerCurrentPath: string;
  activeDialog: ConsoleShellDialog;
  layoutMode: ConsoleShellLayoutMode;
  /** Left column width when open (includes chrome rail). */
  leftPaneWidthPx: number;
  /** Pin diagram width when open (chrome rail is added in the grid track). */
  rightDiagramWidthPx: number;
}

/** Default shell layout after connect and after disconnect (issue #462). */
export const DEFAULT_CONSOLE_SHELL_STATE: ConsoleShellState = {
  activePanel: 'terminal',
  leftNavOpen: true,
  rightNavOpen: true,
  selectedFilePath: null,
  fileManagerCurrentPath: '.',
  activeDialog: 'none',
  layoutMode: 'docked',
  leftPaneWidthPx: LEFT_PANE_WIDTH.default,
  rightDiagramWidthPx: RIGHT_DIAGRAM_WIDTH.default,
};

function clampMin(value: number, min: number): number {
  return Math.max(min, Math.round(value));
}

@Injectable({
  providedIn: 'root',
})
export class ConsoleShellStore {
  private readonly stateSignal = signal<ConsoleShellState>({
    ...DEFAULT_CONSOLE_SHELL_STATE,
  });

  readonly state = this.stateSignal.asReadonly();

  readonly activePanel = computed(
    () => this.stateSignal().activePanel,
  );

  readonly leftNavOpen = computed(
    () => this.stateSignal().leftNavOpen,
  );

  readonly rightNavOpen = computed(
    () => this.stateSignal().rightNavOpen,
  );

  readonly selectedFilePath = computed(
    () => this.stateSignal().selectedFilePath,
  );

  readonly fileManagerCurrentPath = computed(
    () => this.stateSignal().fileManagerCurrentPath,
  );

  readonly activeDialog = computed(
    () => this.stateSignal().activeDialog,
  );

  readonly layoutMode = computed(
    () => this.stateSignal().layoutMode,
  );

  readonly leftPaneWidthPx = computed(
    () => this.stateSignal().leftPaneWidthPx,
  );

  readonly rightDiagramWidthPx = computed(
    () => this.stateSignal().rightDiagramWidthPx,
  );

  setActivePanel(panel: ConsoleShellPanel): void {
    this.stateSignal.update((state) => ({
      ...state,
      activePanel: panel,
    }));
  }

  toggleLeftNav(): void {
    this.stateSignal.update((state) => ({
      ...state,
      leftNavOpen: !state.leftNavOpen,
    }));
  }

  openLeftNav(): void {
    this.stateSignal.update((state) => ({
      ...state,
      leftNavOpen: true,
    }));
  }

  closeLeftNav(): void {
    this.stateSignal.update((state) => ({
      ...state,
      leftNavOpen: false,
    }));
  }

  toggleRightNav(): void {
    this.stateSignal.update((state) => ({
      ...state,
      rightNavOpen: !state.rightNavOpen,
    }));
  }

  openRightNav(): void {
    this.stateSignal.update((state) => ({
      ...state,
      rightNavOpen: true,
    }));
  }

  closeRightNav(): void {
    this.stateSignal.update((state) => ({
      ...state,
      rightNavOpen: false,
    }));
  }

  /**
   * Switch between docked and overlay layout (issue #728).
   * Entering overlay closes both panes; returning to docked opens both.
   */
  setLayoutMode(layoutMode: ConsoleShellLayoutMode): void {
    this.stateSignal.update((state) => {
      if (state.layoutMode === layoutMode) {
        return state;
      }
      if (layoutMode === 'overlay') {
        return {
          ...state,
          layoutMode,
          leftNavOpen: false,
          rightNavOpen: false,
        };
      }
      return {
        ...state,
        layoutMode,
        leftNavOpen: true,
        rightNavOpen: true,
      };
    });
  }

  setLeftPaneWidth(widthPx: number): void {
    this.stateSignal.update((state) => ({
      ...state,
      leftPaneWidthPx: clampMin(widthPx, LEFT_PANE_WIDTH.min),
    }));
  }

  setRightDiagramWidth(widthPx: number): void {
    this.stateSignal.update((state) => ({
      ...state,
      rightDiagramWidthPx: clampMin(widthPx, RIGHT_DIAGRAM_WIDTH.min),
    }));
  }

  setSelectedFilePath(selectedFilePath: string | null): void {
    this.stateSignal.update((state) => ({
      ...state,
      selectedFilePath,
    }));
  }

  setFileManagerCurrentPath(fileManagerCurrentPath: string): void {
    this.stateSignal.update((state) => ({
      ...state,
      fileManagerCurrentPath,
    }));
  }

  openDialog(dialog: Exclude<ConsoleShellDialog, 'none'>): void {
    this.stateSignal.update((state) => ({
      ...state,
      activeDialog: dialog,
    }));
  }

  closeDialog(): void {
    this.stateSignal.update((state) => ({
      ...state,
      activeDialog: 'none',
    }));
  }

  /** Apply expected layout when Web Serial connection succeeds. */
  applyConnectedLayout(): void {
    this.stateSignal.update((state) => ({
      ...DEFAULT_CONSOLE_SHELL_STATE,
      layoutMode: state.layoutMode,
      leftPaneWidthPx: state.leftPaneWidthPx,
      rightDiagramWidthPx: state.rightDiagramWidthPx,
      ...(state.layoutMode === 'overlay'
        ? { leftNavOpen: false, rightNavOpen: false }
        : {}),
    }));
  }

  /** Reset shell UI state when disconnected so reconnect gets a stable layout. */
  resetLayoutAfterDisconnect(): void {
    this.stateSignal.update((state) => ({
      ...DEFAULT_CONSOLE_SHELL_STATE,
      layoutMode: state.layoutMode,
      leftPaneWidthPx: state.leftPaneWidthPx,
      rightDiagramWidthPx: state.rightDiagramWidthPx,
      ...(state.layoutMode === 'overlay'
        ? { leftNavOpen: false, rightNavOpen: false }
        : {}),
    }));
  }
}
