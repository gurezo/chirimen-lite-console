import { describe, expect, it } from 'vitest';
import { buildConsoleShellBreadcrumbSegments } from './breadcrumb-segments';

describe('buildConsoleShellBreadcrumbSegments', () => {
  it('returns Console and active panel', () => {
    const segments = buildConsoleShellBreadcrumbSegments({
      activePanel: 'terminal',
      activeDialog: 'none',
      selectedFilePath: null,
      fileManagerCurrentPath: '.',
    });
    expect(segments.map((s) => s.label)).toEqual(['Console', 'Terminal']);
  });

  it('appends dialog label when a dialog is open', () => {
    const segments = buildConsoleShellBreadcrumbSegments({
      activePanel: 'terminal',
      activeDialog: 'setup',
      selectedFilePath: null,
      fileManagerCurrentPath: '.',
    });
    expect(segments.map((s) => s.label)).toEqual([
      'Console',
      'Terminal',
      'Setup',
    ]);
  });

  it('uses wifi as panel segment when wifi route is active', () => {
    const segments = buildConsoleShellBreadcrumbSegments({
      activePanel: 'wifi',
      activeDialog: 'none',
      selectedFilePath: null,
      fileManagerCurrentPath: '.',
    });
    expect(segments.map((s) => s.label)).toEqual(['Console', 'WiFi']);
  });

  it('appends hierarchical file path when a file is selected', () => {
    const segments = buildConsoleShellBreadcrumbSegments({
      activePanel: 'editor',
      activeDialog: 'none',
      selectedFilePath: '/app/src/main.js',
      fileManagerCurrentPath: '.',
    });
    expect(segments.map((s) => s.label)).toEqual([
      'Console',
      'Editor',
      'app',
      'src',
      'main.js',
    ]);
  });
});
