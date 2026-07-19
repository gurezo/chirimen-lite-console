import { beforeEach, describe, expect, it } from 'vitest';
import {
  ConsoleShellStore,
  DEFAULT_CONSOLE_SHELL_STATE,
  LEFT_PANE_WIDTH,
  RIGHT_DIAGRAM_WIDTH,
} from './console-shell.store';

describe('ConsoleShellStore', () => {
  let store: ConsoleShellStore;

  beforeEach(() => {
    store = new ConsoleShellStore();
  });

  it('should start with DEFAULT_CONSOLE_SHELL_STATE', () => {
    expect(store.state()).toEqual(DEFAULT_CONSOLE_SHELL_STATE);
  });

  it('setFileManagerCurrentPath updates fileManagerCurrentPath', () => {
    store.setFileManagerCurrentPath('./home/pi');
    expect(store.fileManagerCurrentPath()).toBe('./home/pi');
  });

  it('applyConnectedLayout should reset to default layout', () => {
    store.setActivePanel('editor');
    store.closeRightNav();
    store.setSelectedFilePath('/foo');
    store.setFileManagerCurrentPath('./home/pi');
    store.openDialog('setup');

    store.applyConnectedLayout();

    expect(store.state()).toEqual(DEFAULT_CONSOLE_SHELL_STATE);
  });

  it('resetLayoutAfterDisconnect should reset to default layout', () => {
    store.setActivePanel('example');
    store.toggleLeftNav();
    store.closeRightNav();
    store.setFileManagerCurrentPath('./docs');

    store.resetLayoutAfterDisconnect();

    expect(store.state()).toEqual(DEFAULT_CONSOLE_SHELL_STATE);
  });

  it('setLayoutMode to overlay closes both panes', () => {
    store.setLayoutMode('overlay');
    expect(store.layoutMode()).toBe('overlay');
    expect(store.leftNavOpen()).toBe(false);
    expect(store.rightNavOpen()).toBe(false);
  });

  it('setLayoutMode to docked opens both panes', () => {
    store.setLayoutMode('overlay');
    store.setLayoutMode('docked');
    expect(store.layoutMode()).toBe('docked');
    expect(store.leftNavOpen()).toBe(true);
    expect(store.rightNavOpen()).toBe(true);
  });

  it('setLeftPaneWidth clamps to min only', () => {
    store.setLeftPaneWidth(50);
    expect(store.leftPaneWidthPx()).toBe(LEFT_PANE_WIDTH.min);
    store.setLeftPaneWidth(9999);
    expect(store.leftPaneWidthPx()).toBe(9999);
  });

  it('setRightDiagramWidth clamps to min only', () => {
    store.setRightDiagramWidth(10);
    expect(store.rightDiagramWidthPx()).toBe(RIGHT_DIAGRAM_WIDTH.min);
    store.setRightDiagramWidth(9999);
    expect(store.rightDiagramWidthPx()).toBe(9999);
  });

  it('applyConnectedLayout preserves custom pane widths', () => {
    store.setLeftPaneWidth(320);
    store.setRightDiagramWidth(260);
    store.applyConnectedLayout();
    expect(store.leftPaneWidthPx()).toBe(320);
    expect(store.rightDiagramWidthPx()).toBe(260);
  });
});
