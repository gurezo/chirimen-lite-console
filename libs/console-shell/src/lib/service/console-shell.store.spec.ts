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

  it('applyConnectedLayout should reset to default layout', () => {
    store.setActivePanel('editor');
    store.closeRightNav();
    store.setSelectedFilePath('/foo');
    store.openDialog('setup');

    store.applyConnectedLayout();

    expect(store.state()).toEqual(DEFAULT_CONSOLE_SHELL_STATE);
  });

  it('resetLayoutAfterDisconnect should reset to default layout', () => {
    store.setActivePanel('example');
    store.toggleLeftNav();
    store.closeRightNav();

    store.resetLayoutAfterDisconnect();

    expect(store.state()).toEqual(DEFAULT_CONSOLE_SHELL_STATE);
  });
});
