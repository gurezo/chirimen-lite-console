import type { ConsoleShellState } from '../service';

export interface BreadcrumbSegment {
  label: string;
  /** File Manager directory path when this segment is navigable. */
  path?: string;
  clickable?: boolean;
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
 * Splits a File Manager path into breadcrumb segments with cumulative paths.
 * Intermediate directories are clickable; the last segment is not.
 */
export function buildFilePathBreadcrumbSegments(
  rawPath: string,
): BreadcrumbSegment[] {
  const isAbsolute = rawPath.startsWith('/');
  let rest = rawPath;
  if (rest.startsWith('./')) {
    rest = rest.slice(2);
  } else if (rest.startsWith('/')) {
    rest = rest.slice(1);
  }

  if (!rest || rest === '.') {
    return [];
  }

  const parts = rest.split('/').filter(Boolean);
  const segments: BreadcrumbSegment[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    const joined = parts.slice(0, i + 1).join('/');
    const path = isAbsolute ? `/${joined}` : `./${joined}`;

    if (isLast) {
      segments.push({ label: part, clickable: false });
    } else {
      segments.push({ label: part, path, clickable: true });
    }
  }

  return segments;
}

function resolveFileManagerPathSource(
  state: Pick<ConsoleShellState, 'selectedFilePath' | 'fileManagerCurrentPath'>,
): string | null {
  if (state.selectedFilePath) {
    return state.selectedFilePath;
  }
  if (
    state.fileManagerCurrentPath &&
    state.fileManagerCurrentPath !== '.'
  ) {
    return state.fileManagerCurrentPath;
  }
  return null;
}

/**
 * Builds breadcrumb segments from shell state (single source of truth: ConsoleShellStore).
 */
export function buildConsoleShellBreadcrumbSegments(
  state: Pick<
    ConsoleShellState,
    | 'activePanel'
    | 'activeDialog'
    | 'selectedFilePath'
    | 'fileManagerCurrentPath'
  >,
): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [{ label: 'Console' }];
  segments.push({ label: PANEL_LABELS[state.activePanel] });

  if (state.activeDialog !== 'none') {
    segments.push({ label: DIALOG_LABELS[state.activeDialog] });
  }

  const pathSource = resolveFileManagerPathSource(state);
  if (pathSource) {
    segments.push(...buildFilePathBreadcrumbSegments(pathSource));
  }

  return segments;
}
