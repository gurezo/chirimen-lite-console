import { computed, Injectable, signal } from '@angular/core';

type ConsoleShellPanel = 'terminal' | 'editor' | 'example' | 'wifi';
type ConsoleShellDialog = 'none' | 'setup' | 'remote';

export interface ConsoleShellState {
  activePanel: ConsoleShellPanel;
  leftNavOpen: boolean;
  rightNavOpen: boolean;
  selectedFilePath: string | null;
  activeDialog: ConsoleShellDialog;
}

/** Default shell layout after connect and after disconnect (issue #462). */
export const DEFAULT_CONSOLE_SHELL_STATE: ConsoleShellState = {
  activePanel: 'terminal',
  leftNavOpen: true,
  rightNavOpen: true,
  selectedFilePath: null,
  activeDialog: 'none',
};

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

  readonly activeDialog = computed(
    () => this.stateSignal().activeDialog,
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

  setSelectedFilePath(selectedFilePath: string | null): void {
    this.stateSignal.update((state) => ({
      ...state,
      selectedFilePath,
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
    this.stateSignal.set({ ...DEFAULT_CONSOLE_SHELL_STATE });
  }

  /** Reset shell UI state when disconnected so reconnect gets a stable layout. */
  resetLayoutAfterDisconnect(): void {
    this.stateSignal.set({ ...DEFAULT_CONSOLE_SHELL_STATE });
  }
}

