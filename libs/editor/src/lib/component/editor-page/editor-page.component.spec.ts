/// <reference types="vitest/globals" />
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogService } from '@libs-dialogs';
import { ConsoleShellStore } from '@libs-shared';
import { SerialFacadeService } from '@libs-web-serial';
import { provideMonacoEditor } from 'ngx-monaco-editor-v2';
import { Subject } from 'rxjs';
import { EditorDraftService, EditorService } from '../../service';
import { EditorPageComponent } from './editor-page.component';

describe('EditorPageComponent', () => {
  let component: EditorPageComponent;
  let fixture: ComponentFixture<EditorPageComponent>;
  const selectedFilePathSignal = signal<string | null>(null);
  const isConnectedSignal = signal(true);
  const editorServiceMock = {
    loadTextFile: vi.fn().mockResolvedValue('loaded content'),
    saveTextFile: vi.fn().mockResolvedValue(undefined),
    initializeEditor: vi.fn(),
  };
  const shellStoreMock = {
    selectedFilePath: () => selectedFilePathSignal(),
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
  };
  const dialogServiceMock = {
    open: vi.fn(),
  };
  const serialFacadeMock = {
    isConnected: () => isConnectedSignal(),
  };

  async function loadPath(path: string, content = 'loaded content'): Promise<void> {
    editorServiceMock.loadTextFile.mockResolvedValue(content);
    selectedFilePathSignal.set(path);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function mockDialogResult(result: unknown): Subject<unknown> {
    const closed = new Subject<unknown>();
    dialogServiceMock.open.mockReturnValueOnce({
      closed: closed.asObservable(),
    });
    return closed;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    selectedFilePathSignal.set(null);
    isConnectedSignal.set(true);
    draftServiceMock.read.mockReturnValue(null);
    draftServiceMock.list.mockReturnValue([]);
    editorServiceMock.loadTextFile.mockResolvedValue('loaded content');

    await TestBed.configureTestingModule({
      imports: [EditorPageComponent],
      providers: [provideMonacoEditor({})],
    })
      .overrideProvider(EditorService, { useValue: editorServiceMock })
      .overrideProvider(EditorDraftService, { useValue: draftServiceMock })
      .overrideProvider(ConsoleShellStore, { useValue: shellStoreMock })
      .overrideProvider(DialogService, { useValue: dialogServiceMock })
      .overrideProvider(SerialFacadeService, { useValue: serialFacadeMock })
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

    editorServiceMock.loadTextFile.mockRejectedValue(
      new Error('Target file is not a text file'),
    );
    selectedFilePathSignal.set('/home/pi/binary.bin');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.code()).toBe(previousCode);
    expect(component.currentFileName()).toBe('ok.js');
    expect(component.loadError()).toEqual({
      path: '/home/pi/binary.bin',
      message: 'Target file is not a text file',
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
    );
    expect(component.isDirty()).toBe(false);
    expect(component.saveStatus()).toBe('savedToDevice');
    expect(draftServiceMock.clear).toHaveBeenCalledWith('/home/pi/main.js');
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
    expect(component.saveError()).toBe(
      'Save failed: write permission was denied for the target file.',
    );
    expect(draftServiceMock.clear).not.toHaveBeenCalled();
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
    expect(component.saveError()).toContain('connection was lost or cancelled');
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
    isConnectedSignal.set(false);

    await component.saveCurrentFile();

    expect(editorServiceMock.saveTextFile).not.toHaveBeenCalled();
    expect(component.isDirty()).toBe(true);
  });

  it('should disable save in the toolbar when serial is disconnected', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');
    component.onCodeChange('updated');
    component.onContentEdited();
    isConnectedSignal.set(false);
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
    editorServiceMock.loadTextFile.mockResolvedValue('device content');

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
    editorServiceMock.loadTextFile.mockResolvedValue('device content');

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
});
