/// <reference types="vitest/globals" />
import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogService } from '@libs-dialogs';
import { FileService } from '@libs-file-manager';
import { ConsoleShellStore, NotificationService } from '@libs-shared';
import type { SerialConnectionViewModel } from '@libs-web-serial';
import { SerialConnectionViewModelFacade } from '@libs-web-serial';
import { provideMonacoEditor } from 'ngx-monaco-editor-v2';
import { Subject } from 'rxjs';
import { EditorDraftService, EditorService } from '../../service';
import { EditorPageComponent } from './editor-page.component';

describe('EditorPageComponent', () => {
  let component: EditorPageComponent;
  let fixture: ComponentFixture<EditorPageComponent>;
  const selectedFilePathSignal = signal<string | null>(null);
  const connectionVmSignal = signal<SerialConnectionViewModel>({
    isBrowserSupported: true,
    isConnected: true,
    isConnecting: false,
    isLoggedIn: true,
    isInitializing: false,
    setupStatus: 'ready',
    errorMessage: null,
  });
  const editorServiceMock = {
    loadTextFile: vi.fn().mockResolvedValue({
      content: 'loaded content',
      meta: {
        encoding: 'utf-8',
        bom: false,
        lineEnding: 'lf',
        trailingNewline: true,
      },
      size: 14,
    }),
    saveTextFile: vi.fn().mockResolvedValue(undefined),
    getByteSize: vi.fn().mockResolvedValue(14),
    cancelTransfer: vi.fn(),
    applyLineEnding: vi.fn(),
    initializeEditor: vi.fn(),
    formatDocument: vi.fn().mockResolvedValue(true),
    getValue: vi.fn().mockReturnValue(null),
  };
  const shellStoreMock = {
    selectedFilePath: () => selectedFilePathSignal(),
    fileManagerCurrentPath: () => '.',
    setSelectedFilePath: vi.fn((path: string | null) => {
      selectedFilePathSignal.set(path);
    }),
  };
  const draftServiceMock = {
    read: vi.fn(() => null),
    list: vi.fn(() => []),
    has: vi.fn(() => false),
    save: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
    rename: vi.fn(),
  };
  const dialogServiceMock = {
    open: vi.fn(),
  };
  const fileServiceMock = {
    exists: vi.fn().mockResolvedValue(false),
    touch: vi.fn().mockResolvedValue(undefined),
  };
  const connectionVmMock = {
    vm: computed(() => connectionVmSignal()),
  };
  const notifyMock = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  function loadedFile(
    content: string,
    overrides?: Partial<{ size: number; lineEnding: 'lf' | 'crlf' }>,
  ) {
    return {
      content,
      meta: {
        encoding: 'utf-8' as const,
        bom: false,
        lineEnding: overrides?.lineEnding ?? ('lf' as const),
        trailingNewline: content.endsWith('\n'),
      },
      size: overrides?.size ?? content.length,
    };
  }

  async function loadPath(path: string, content = 'loaded content'): Promise<void> {
    editorServiceMock.loadTextFile.mockResolvedValue(loadedFile(content));
    editorServiceMock.getByteSize.mockResolvedValue(content.length);
    selectedFilePathSignal.set(path);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function mockDialogResult(_result: unknown): Subject<unknown> {
    const closed = new Subject<unknown>();
    dialogServiceMock.open.mockReturnValueOnce({
      closed: closed.asObservable(),
    });
    return closed;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    selectedFilePathSignal.set(null);
    connectionVmSignal.set({
      isBrowserSupported: true,
      isConnected: true,
      isConnecting: false,
      isLoggedIn: true,
      isInitializing: false,
      setupStatus: 'ready',
      errorMessage: null,
    });
    draftServiceMock.read.mockReturnValue(null);
    draftServiceMock.list.mockReturnValue([]);
    draftServiceMock.has.mockReturnValue(false);
    editorServiceMock.loadTextFile.mockResolvedValue({
      content: 'loaded content',
      meta: {
        encoding: 'utf-8',
        bom: false,
        lineEnding: 'lf',
        trailingNewline: true,
      },
      size: 14,
    });
    editorServiceMock.getByteSize.mockResolvedValue(14);
    fileServiceMock.exists.mockResolvedValue(false);
    fileServiceMock.touch.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [EditorPageComponent],
      providers: [provideMonacoEditor({})],
    })
      .overrideProvider(EditorService, { useValue: editorServiceMock })
      .overrideProvider(EditorDraftService, { useValue: draftServiceMock })
      .overrideProvider(ConsoleShellStore, { useValue: shellStoreMock })
      .overrideProvider(DialogService, { useValue: dialogServiceMock })
      .overrideProvider(FileService, { useValue: fileServiceMock })
      .overrideProvider(SerialConnectionViewModelFacade, {
        useValue: connectionVmMock,
      })
      .overrideProvider(NotificationService, { useValue: notifyMock })
      .compileComponents();

    fixture = TestBed.createComponent(EditorPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with an empty editor when no file is selected', () => {
    expect(component.code()).toBe('');
    expect(component.currentFileName()).toBeNull();
    expect(editorServiceMock.loadTextFile).not.toHaveBeenCalled();
  });

  it('should load the selected file into the editor', async () => {
    await loadPath('/home/pi/main.js', 'console.log(1)');

    expect(editorServiceMock.loadTextFile).toHaveBeenCalledWith(
      '/home/pi/main.js',
    );
    expect(component.code()).toBe('console.log(1)');
    expect(component.currentFileName()).toBe('main.js');
    expect(component.isDirty()).toBe(false);
    expect(component.saveStatus()).toBe('savedToDevice');
    expect(component.loadError()).toBeNull();
  });

  it('should load an empty file without error', async () => {
    await loadPath('/home/pi/empty.js', '');

    expect(component.code()).toBe('');
    expect(component.currentFileName()).toBe('empty.js');
    expect(component.loadError()).toBeNull();
  });

  it('should show load error and keep previous content on failure', async () => {
    await loadPath('/home/pi/ok.js', 'previous');
    const previousCode = component.code();

    editorServiceMock.getByteSize.mockResolvedValue(8);
    editorServiceMock.loadTextFile.mockRejectedValue(
      new Error('Target file is not a text file'),
    );
    selectedFilePathSignal.set('/home/pi/binary.bin');
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();

    expect(component.code()).toBe(previousCode);
    expect(component.currentFileName()).toBe('ok.js');
    expect(component.loadError()).toEqual({
      path: '/home/pi/binary.bin',
      message: 'ファイルの読み込みに失敗しました: /home/pi/binary.bin',
      detail: 'Target file is not a text file',
    });
  });

  it('should skip reloading the same path while idle', async () => {
    await loadPath('/home/pi/main.js', 'once');
    editorServiceMock.loadTextFile.mockClear();

    await (
      component as unknown as { loadFile: (path: string) => Promise<void> }
    ).loadFile('/home/pi/main.js');

    expect(editorServiceMock.loadTextFile).not.toHaveBeenCalled();
  });

  it('should save current file and clear dirty state', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');
    component.onCodeChange('updated');
    component.onContentEdited();

    await component.saveCurrentFile();

    expect(editorServiceMock.saveTextFile).toHaveBeenCalledWith(
      '/home/pi/main.js',
      'updated',
      {
        encoding: 'utf-8',
        bom: false,
        lineEnding: 'lf',
        trailingNewline: false,
      },
    );
    expect(component.isDirty()).toBe(false);
    expect(component.saveStatus()).toBe('savedToDevice');
    expect(draftServiceMock.clear).toHaveBeenCalledWith('/home/pi/main.js');
    expect(notifyMock.success).toHaveBeenCalledWith(
      '保存成功',
      'デバイスへ保存しました',
    );
  });

  it('should keep edits and draft when save fails', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');
    component.onCodeChange('updated');
    component.onContentEdited();
    editorServiceMock.saveTextFile.mockRejectedValueOnce(
      new Error('Save failed: write permission was denied for the target file.'),
    );

    await component.saveCurrentFile();

    expect(component.code()).toBe('updated');
    expect(component.isDirty()).toBe(true);
    expect(component.saveStatus()).toBe('saveFailed');
    expect(component.saveError()?.detail).toBe(
      'Save failed: write permission was denied for the target file.',
    );
    expect(component.saveError()?.message).toContain('Draft');
    expect(draftServiceMock.clear).not.toHaveBeenCalled();
    expect(notifyMock.error).toHaveBeenCalledWith(
      '保存失敗',
      'デバイスへの保存に失敗しました',
    );
  });

  it('should surface disconnect errors without clearing draft', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');
    component.onCodeChange('updated');
    component.onContentEdited();
    editorServiceMock.saveTextFile.mockRejectedValueOnce(
      new Error(
        'Save failed: serial connection was lost or cancelled. Reconnect and try again.',
      ),
    );

    await component.saveCurrentFile();

    expect(component.saveStatus()).toBe('saveFailed');
    expect(component.saveError()?.detail).toContain(
      'connection was lost or cancelled',
    );
    expect(component.code()).toBe('updated');
    expect(draftServiceMock.clear).not.toHaveBeenCalled();
  });

  it('should skip save when dirty state is false', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');

    await component.saveCurrentFile();

    expect(editorServiceMock.saveTextFile).not.toHaveBeenCalled();
  });

  it('should skip save when serial is disconnected', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');
    component.onCodeChange('updated');
    component.onContentEdited();
    connectionVmSignal.update((vm) => ({ ...vm, isConnected: false }));

    await component.saveCurrentFile();

    expect(editorServiceMock.saveTextFile).not.toHaveBeenCalled();
    expect(component.isDirty()).toBe(true);
  });

  it('should disable save in the toolbar when serial is disconnected', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');
    component.onCodeChange('updated');
    component.onContentEdited();
    connectionVmSignal.update((vm) => ({ ...vm, isConnected: false }));
    fixture.detectChanges();
    await fixture.whenStable();

    const saveButton = fixture.nativeElement.querySelector(
      'choh-editor-toolbar button',
    ) as HTMLButtonElement;

    expect(saveButton.disabled).toBe(true);
  });

  it('should mark unsaved then draft-saved without claiming device save', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');
    component.onCodeChange('updated draft');
    component.onContentEdited();

    expect(draftServiceMock.save).toHaveBeenCalledWith(
      '/home/pi/main.js',
      'updated draft',
    );
    expect(component.saveStatus()).toBe('draftSavedLocally');
    expect(component.saveStatus()).not.toBe('savedToDevice');
    expect(component.isDirty()).toBe(true);
  });

  it('should prompt to restore a draft instead of auto-loading remote content', async () => {
    const closed = mockDialogResult('restore');
    draftServiceMock.list.mockReturnValueOnce([
      {
        path: '/home/pi/draft.js',
        content: 'restored draft',
        updatedAt: Date.now(),
      },
    ]);
    editorServiceMock.loadTextFile.mockResolvedValue(loadedFile('device content'));

    const initPromise = component.ngOnInit();
    closed.next('restore');
    closed.complete();
    await initPromise;

    expect(dialogServiceMock.open).toHaveBeenCalled();
    expect(component.code()).toBe('restored draft');
    expect(component.currentFileName()).toBe('draft.js');
    expect(component.isDirty()).toBe(true);
    expect(component.saveStatus()).toBe('draftSavedLocally');
  });

  it('should reload from device when draft resolve chooses reload', async () => {
    const closed = mockDialogResult('reload');
    draftServiceMock.list.mockReturnValueOnce([
      {
        path: '/home/pi/draft.js',
        content: 'restored draft',
        updatedAt: Date.now(),
      },
    ]);
    editorServiceMock.loadTextFile.mockResolvedValue(loadedFile('device content'));

    const initPromise = component.ngOnInit();
    closed.next('reload');
    closed.complete();
    await initPromise;

    expect(draftServiceMock.clear).toHaveBeenCalledWith('/home/pi/draft.js');
    expect(component.code()).toBe('device content');
    expect(component.saveStatus()).toBe('savedToDevice');
    expect(component.isDirty()).toBe(false);
  });

  it('should confirm before switching files while dirty', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');
    component.onCodeChange('dirty');
    component.onContentEdited();

    const closed = mockDialogResult(false);
    editorServiceMock.loadTextFile.mockClear();

    const switchPromise = (
      component as unknown as { loadFile: (path: string) => Promise<void> }
    ).loadFile('/home/pi/other.js');
    closed.next(false);
    closed.complete();
    await switchPromise;

    expect(component.currentFileName()).toBe('main.js');
    expect(component.code()).toBe('dirty');
    expect(shellStoreMock.setSelectedFilePath).toHaveBeenCalledWith(
      '/home/pi/main.js',
    );
    expect(editorServiceMock.loadTextFile).not.toHaveBeenCalled();
  });

  it('should discard dirty changes back to baseline', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');
    component.onCodeChange('dirty');
    component.onContentEdited();

    const closed = mockDialogResult(true);

    const discardPromise = component.discardChanges();
    closed.next(true);
    closed.complete();
    await discardPromise;

    expect(component.code()).toBe('loaded content');
    expect(component.saveStatus()).toBe('savedToDevice');
    expect(draftServiceMock.clear).toHaveBeenCalledWith('/home/pi/main.js');
  });

  it('should allow deactivation when clean', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');

    await expect(component.canDeactivate()).resolves.toBe(true);
    expect(dialogServiceMock.open).not.toHaveBeenCalled();
  });

  it('should confirm before deactivating while dirty', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');
    component.onCodeChange('dirty');
    component.onContentEdited();

    const closed = mockDialogResult(false);
    const deactivatePromise = component.canDeactivate();
    closed.next(false);
    closed.complete();

    await expect(deactivatePromise).resolves.toBe(false);
  });

  it('should format the current file and mark it dirty', async () => {
    await loadPath('/home/pi/main.js', 'const x=1');
    editorServiceMock.formatDocument.mockResolvedValueOnce(true);
    editorServiceMock.getValue.mockReturnValueOnce('const x = 1;\n');

    await component.formatCurrentFile();

    expect(editorServiceMock.formatDocument).toHaveBeenCalledTimes(1);
    expect(component.code()).toBe('const x = 1;\n');
    expect(component.isDirty()).toBe(true);
    expect(component.saveStatus()).toBe('draftSavedLocally');
    expect(notifyMock.warning).not.toHaveBeenCalled();
  });

  it('should warn when no formatter is available', async () => {
    await loadPath('/home/pi/main.js', 'const x=1');
    editorServiceMock.formatDocument.mockResolvedValueOnce(false);

    await component.formatCurrentFile();

    expect(notifyMock.warning).toHaveBeenCalledWith(
      'フォーマット',
      'この言語向けのフォーマッターはありません。',
    );
    expect(component.code()).toBe('const x=1');
    expect(component.isDirty()).toBe(false);
  });

  it('should skip format when no file is selected', async () => {
    await component.formatCurrentFile();

    expect(editorServiceMock.formatDocument).not.toHaveBeenCalled();
  });

  it('should resolve monaco language from the open file extension', async () => {
    await loadPath('/home/pi/readme.md', '# hi');

    expect(component.languageLabel()).toBe('Markdown');
    expect(component.monacoOptions().language).toBe('markdown');
    expect(component.currentFilePath()).toBe('/home/pi/readme.md');
  });

  it('should fall back to plaintext for unknown extensions', async () => {
    await loadPath('/home/pi/data.bin', 'raw');

    expect(component.languageLabel()).toBe('Plain Text');
    expect(component.monacoOptions().language).toBe('plaintext');
  });

  it('should record last device save time after a successful save', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');
    expect(component.lastDeviceSavedAt()).toBeNull();

    component.onCodeChange('updated');
    component.onContentEdited();
    await component.saveCurrentFile();

    expect(component.saveStatus()).toBe('savedToDevice');
    expect(component.lastDeviceSavedAt()).toEqual(expect.any(Number));
  });

  it('should mark read-only when save fails with permission denied', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');
    component.onCodeChange('updated');
    component.onContentEdited();
    editorServiceMock.saveTextFile.mockRejectedValueOnce(
      new Error('Save failed: write permission was denied for the target file.'),
    );

    await component.saveCurrentFile();

    expect(component.isReadOnly()).toBe(true);
    expect(component.monacoOptions().readOnly).toBe(true);
  });

  it('should clear read-only when opening another file', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');
    component.onCodeChange('updated');
    component.onContentEdited();
    editorServiceMock.saveTextFile.mockRejectedValueOnce(
      new Error('Save failed: write permission was denied for the target file.'),
    );
    await component.saveCurrentFile();
    expect(component.isReadOnly()).toBe(true);

    const closed = mockDialogResult(true);
    const switchPromise = (
      component as unknown as { loadFile: (path: string) => Promise<void> }
    ).loadFile('/home/pi/other.js');
    closed.next(true);
    closed.complete();
    await switchPromise;
    await fixture.whenStable();

    expect(component.isReadOnly()).toBe(false);
    expect(component.lastDeviceSavedAt()).toBeNull();
  });

  it('should clear the editor when selection becomes null', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');
    expect(component.currentFilePath()).toBe('/home/pi/main.js');

    selectedFilePathSignal.set(null);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.currentFilePath()).toBeNull();
    expect(component.code()).toBe('');
    expect(component.saveStatus()).toBeNull();
  });

  it('should retarget the open path after a draft rename without reloading', async () => {
    await loadPath('/home/pi/old.js', 'body');
    component.onCodeChange('dirty body');
    component.onContentEdited();
    draftServiceMock.has.mockImplementation(
      (path: string) => path === '/home/pi/new.js',
    );
    draftServiceMock.read.mockImplementation((path: string) =>
      path === '/home/pi/new.js'
        ? { path, content: 'dirty body', updatedAt: 1 }
        : null,
    );
    editorServiceMock.loadTextFile.mockClear();

    selectedFilePathSignal.set('/home/pi/new.js');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.currentFilePath()).toBe('/home/pi/new.js');
    expect(component.code()).toBe('dirty body');
    expect(editorServiceMock.loadTextFile).not.toHaveBeenCalled();
  });

  it('should create a new file from the toolbar and open it', async () => {
    const closed = mockDialogResult('created.js');
    const createPromise = component.createNewFile();
    closed.next('created.js');
    closed.complete();
    await createPromise;

    expect(fileServiceMock.exists).toHaveBeenCalledWith('./created.js');
    expect(fileServiceMock.touch).toHaveBeenCalledWith('./created.js');
    expect(shellStoreMock.setSelectedFilePath).toHaveBeenCalledWith(
      './created.js',
    );
  });

  it('should not create a file when the destination already exists', async () => {
    fileServiceMock.exists.mockResolvedValueOnce(true);
    const closed = mockDialogResult('dup.js');
    const createPromise = component.createNewFile();
    closed.next('dup.js');
    closed.complete();
    await createPromise;

    expect(fileServiceMock.touch).not.toHaveBeenCalled();
    expect(notifyMock.error).toHaveBeenCalled();
  });

  it('should retry loading the path from loadError', async () => {
    await loadPath('/home/pi/ok.js', 'ok');
    component.loadError.set({
      path: '/home/pi/binary.bin',
      message: 'ファイルの読み込みに失敗しました: /home/pi/binary.bin',
      detail: 'Target file is not a text file',
    });

    editorServiceMock.loadTextFile.mockClear();
    editorServiceMock.loadTextFile.mockResolvedValue(loadedFile('recovered'));
    editorServiceMock.getByteSize.mockResolvedValue(9);

    await component.retryLoadCurrentFile();

    expect(editorServiceMock.loadTextFile).toHaveBeenCalledWith(
      '/home/pi/binary.bin',
    );
    expect(component.loadError()).toBeNull();
    expect(component.code()).toBe('recovered');
  });

  it('should skip format when serial is disconnected', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');
    connectionVmSignal.update((vm) => ({ ...vm, isConnected: false }));
    editorServiceMock.formatDocument.mockClear();

    await component.formatCurrentFile();

    expect(editorServiceMock.formatDocument).not.toHaveBeenCalled();
  });

  it('should refuse files larger than the max size', async () => {
    const { EDITOR_FILE_MAX_BYTES } = await import('@libs-web-serial');
    editorServiceMock.getByteSize.mockResolvedValue(EDITOR_FILE_MAX_BYTES + 1);
    editorServiceMock.loadTextFile.mockClear();

    selectedFilePathSignal.set('/home/pi/huge.js');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(editorServiceMock.loadTextFile).not.toHaveBeenCalled();
    expect(notifyMock.error).toHaveBeenCalled();
    expect(component.loadError()?.path).toBe('/home/pi/huge.js');
  });

  it('should confirm before opening warn-sized files', async () => {
    const { EDITOR_FILE_WARN_BYTES } = await import('@libs-web-serial');
    const confirmClosed = new Subject<unknown>();
    dialogServiceMock.open
      .mockReturnValueOnce({ closed: confirmClosed.asObservable() })
      .mockReturnValueOnce({
        closed: new Subject<unknown>().asObservable(),
        close: vi.fn(),
      });

    editorServiceMock.getByteSize.mockResolvedValue(EDITOR_FILE_WARN_BYTES);
    editorServiceMock.loadTextFile.mockResolvedValue(
      loadedFile('big', { size: EDITOR_FILE_WARN_BYTES }),
    );

    const fetchPromise = (
      component as unknown as {
        fetchDeviceFile: (path: string) => Promise<void>;
      }
    ).fetchDeviceFile('/home/pi/big.js');
    await Promise.resolve();
    confirmClosed.next(true);
    confirmClosed.complete();
    await fetchPromise;

    expect(dialogServiceMock.open).toHaveBeenCalled();
    expect(editorServiceMock.loadTextFile).toHaveBeenCalledWith('/home/pi/big.js');
    expect(component.code()).toBe('big');
    expect(component.saveStatus()).toBe('savedToDevice');
  });

  it('should abort warn-sized open when the user cancels', async () => {
    const { EDITOR_FILE_WARN_BYTES } = await import('@libs-web-serial');
    const confirmClosed = new Subject<unknown>();
    dialogServiceMock.open.mockReturnValueOnce({
      closed: confirmClosed.asObservable(),
    });
    editorServiceMock.getByteSize.mockResolvedValue(EDITOR_FILE_WARN_BYTES);
    editorServiceMock.loadTextFile.mockClear();

    const fetchPromise = (
      component as unknown as {
        fetchDeviceFile: (path: string) => Promise<void>;
      }
    ).fetchDeviceFile('/home/pi/big.js');
    await Promise.resolve();
    confirmClosed.next(false);
    confirmClosed.complete();
    await fetchPromise;

    expect(editorServiceMock.loadTextFile).not.toHaveBeenCalled();
  });

  it('should refuse non UTF-8 files', async () => {
    const { NonUtf8TextError } = await import('@libs-web-serial');
    editorServiceMock.getByteSize.mockResolvedValue(3);
    editorServiceMock.loadTextFile.mockRejectedValue(new NonUtf8TextError());

    selectedFilePathSignal.set('/home/pi/bad.js');
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();

    expect(notifyMock.error).toHaveBeenCalledWith(
      '読込失敗',
      'UTF-8 ではないためファイルを開けません。',
    );
    expect(component.loadError()?.message).toContain('UTF-8');
  });
});
