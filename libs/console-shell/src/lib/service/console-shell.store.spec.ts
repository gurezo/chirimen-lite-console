import { beforeEach, describe, expect, it } from 'vitest';
import {
  ConsoleShellStore,
  DEFAULT_CONSOLE_SHELL_STATE,
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
    expect(store.leftNavOpen()).toBe(true);
    expect(store.rightNavOpen()).toBe(true);

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

  it('setLayoutMode is a no-op when mode is unchanged', () => {
    store.closeLeftNav();
    store.setLayoutMode('docked');

    expect(store.leftNavOpen()).toBe(false);
  });

  it('applyConnectedLayout preserves overlay mode and keeps panes closed', () => {
    store.setLayoutMode('overlay');
    store.openLeftNav();
    store.setActivePanel('editor');

    store.applyConnectedLayout();

    expect(store.layoutMode()).toBe('overlay');
    expect(store.leftNavOpen()).toBe(false);
    expect(store.rightNavOpen()).toBe(false);
    expect(store.activePanel()).toBe('terminal');
  });
});
