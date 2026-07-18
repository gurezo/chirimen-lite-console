import { describe, expect, it } from 'vitest';
import {
  buildConsoleShellBreadcrumbSegments,
  buildFilePathBreadcrumbSegments,
} from './breadcrumb-segments';

describe('buildFilePathBreadcrumbSegments', () => {
  it('returns empty for root path', () => {
    expect(buildFilePathBreadcrumbSegments('.')).toEqual([]);
    expect(buildFilePathBreadcrumbSegments('./')).toEqual([]);
  });

  it('splits relative paths into clickable prefixes', () => {
    const segments = buildFilePathBreadcrumbSegments(
      './home/pi/chirimen/examples/main.js',
    );
    expect(segments).toEqual([
      { label: 'home', path: './home', clickable: true },
      { label: 'pi', path: './home/pi', clickable: true },
      { label: 'chirimen', path: './home/pi/chirimen', clickable: true },
      {
        label: 'examples',
        path: './home/pi/chirimen/examples',
        clickable: true,
      },
      { label: 'main.js', clickable: false },
    ]);
  });

  it('splits absolute paths into clickable prefixes', () => {
    const segments = buildFilePathBreadcrumbSegments('/app/src/main.js');
    expect(segments).toEqual([
      { label: 'app', path: '/app', clickable: true },
      { label: 'src', path: '/app/src', clickable: true },
      { label: 'main.js', clickable: false },
    ]);
  });

  it('marks only the last directory segment as current when browsing', () => {
    const segments = buildFilePathBreadcrumbSegments('./home/pi/docs');
    expect(segments.map((s) => ({ label: s.label, clickable: s.clickable }))).toEqual(
      [
        { label: 'home', clickable: true },
        { label: 'pi', clickable: true },
        { label: 'docs', clickable: false },
      ],
    );
  });
});

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
    expect(segments[1]).toEqual({
      label: 'Editor',
      path: '.',
      clickable: true,
    });
  });

  it('makes Terminal clickable to return home when browsing a directory', () => {
    const segments = buildConsoleShellBreadcrumbSegments({
      activePanel: 'terminal',
      activeDialog: 'none',
      selectedFilePath: null,
      fileManagerCurrentPath: './home/pi',
    });
    expect(segments[1]).toEqual({
      label: 'Terminal',
      path: '.',
      clickable: true,
    });
    expect(segments.map((s) => s.label)).toEqual([
      'Console',
      'Terminal',
      'home',
      'pi',
    ]);
  });

  it('prefers selectedFilePath over fileManagerCurrentPath', () => {
    const segments = buildConsoleShellBreadcrumbSegments({
      activePanel: 'terminal',
      activeDialog: 'none',
      selectedFilePath: './docs/readme.md',
      fileManagerCurrentPath: './other',
    });
    expect(segments.map((s) => s.label)).toEqual([
      'Console',
      'Terminal',
      'docs',
      'readme.md',
    ]);
  });

  it('appends directory path when browsing without a selected file', () => {
    const segments = buildConsoleShellBreadcrumbSegments({
      activePanel: 'terminal',
      activeDialog: 'none',
      selectedFilePath: null,
      fileManagerCurrentPath: './home/pi',
    });
    expect(segments.map((s) => s.label)).toEqual([
      'Console',
      'Terminal',
      'home',
      'pi',
    ]);
  });

  it('does not append path segments at file manager root', () => {
    const segments = buildConsoleShellBreadcrumbSegments({
      activePanel: 'editor',
      activeDialog: 'none',
      selectedFilePath: null,
      fileManagerCurrentPath: '.',
    });
    expect(segments.map((s) => s.label)).toEqual(['Console', 'Editor']);
  });
});
