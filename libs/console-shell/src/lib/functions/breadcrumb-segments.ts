import type { ConsoleShellState } from '../service/console-shell.store';

export interface BreadcrumbSegment {
  label: string;
}

const PANEL_LABELS: Record<ConsoleShellState['activePanel'], string> = {
  terminal: 'Terminal',
  editor: 'Editor',
  example: 'Example',
  wifi: 'WiFi',
};

const DIALOG_LABELS: Record<
  Exclude<ConsoleShellState['activeDialog'], 'none'>,
  string
> = {
  setup: 'Setup',
  remote: 'Remote',
};

/**
 * Builds breadcrumb segments from shell state (single source of truth: ConsoleShellStore).
 */
export function buildConsoleShellBreadcrumbSegments(
  state: Pick<
    ConsoleShellState,
    'activePanel' | 'activeDialog' | 'selectedFilePath'
  >,
): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [{ label: 'Console' }];
  segments.push({ label: PANEL_LABELS[state.activePanel] });

  if (state.activeDialog !== 'none') {
    segments.push({ label: DIALOG_LABELS[state.activeDialog] });
  }

  if (state.activePanel === 'editor' && state.selectedFilePath) {
    const basename =
      state.selectedFilePath.split('/').pop() ?? state.selectedFilePath;
    segments.push({ label: basename });
  }

  return segments;
}
