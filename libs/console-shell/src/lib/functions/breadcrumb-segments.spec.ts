import { describe, expect, it } from 'vitest';
import { buildConsoleShellBreadcrumbSegments } from './breadcrumb-segments';

describe('buildConsoleShellBreadcrumbSegments', () => {
  it('returns Console and active panel', () => {
    const segments = buildConsoleShellBreadcrumbSegments({
      activePanel: 'terminal',
      activeDialog: 'none',
      selectedFilePath: null,
    });
    expect(segments.map((s) => s.label)).toEqual(['Console', 'Terminal']);
  });

  it('appends dialog label when a dialog is open', () => {
    const segments = buildConsoleShellBreadcrumbSegments({
      activePanel: 'terminal',
      activeDialog: 'setup',
      selectedFilePath: null,
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
    });
    expect(segments.map((s) => s.label)).toEqual(['Console', 'WiFi']);
  });

  it('appends file basename in editor when a file is selected', () => {
    const segments = buildConsoleShellBreadcrumbSegments({
      activePanel: 'editor',
      activeDialog: 'none',
      selectedFilePath: '/app/src/main.js',
    });
    expect(segments.map((s) => s.label)).toEqual([
      'Console',
      'Editor',
      'main.js',
    ]);
  });
});
