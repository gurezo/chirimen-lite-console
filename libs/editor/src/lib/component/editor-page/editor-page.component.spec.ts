/// <reference types="vitest/globals" />
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConsoleShellStore } from '@libs-shared';
import { provideMonacoEditor } from 'ngx-monaco-editor-v2';
import { EditorDraftService, EditorService } from '../../service';
import { EditorPageComponent } from './editor-page.component';

describe('EditorPageComponent', () => {
  let component: EditorPageComponent;
  let fixture: ComponentFixture<EditorPageComponent>;
  const selectedFilePathSignal = signal<string | null>(null);
  const editorServiceMock = {
    loadTextFile: vi.fn().mockResolvedValue('loaded content'),
    saveTextFile: vi.fn().mockResolvedValue(undefined),
    initializeEditor: vi.fn(),
  };
  const shellStoreMock = {
    selectedFilePath: () => selectedFilePathSignal(),
  };
  const draftServiceMock = {
    read: vi.fn(() => null),
    list: vi.fn(() => []),
    has: vi.fn(() => false),
    save: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
  };

  async function loadPath(path: string, content = 'loaded content'): Promise<void> {
    editorServiceMock.loadTextFile.mockResolvedValue(content);
    selectedFilePathSignal.set(path);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    selectedFilePathSignal.set(null);
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
      new Error('device busy'),
    );

    await component.saveCurrentFile();

    expect(component.code()).toBe('updated');
    expect(component.isDirty()).toBe(true);
    expect(component.saveStatus()).toBe('saveFailed');
    expect(component.saveError()).toBe('device busy');
    expect(draftServiceMock.clear).not.toHaveBeenCalled();
  });

  it('should skip save when dirty state is false', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');

    await component.saveCurrentFile();

    expect(editorServiceMock.saveTextFile).not.toHaveBeenCalled();
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

  it('should restore a session draft before loading the remote file', async () => {
    draftServiceMock.list.mockReturnValueOnce([
      {
        path: '/home/pi/draft.js',
        content: 'restored draft',
        updatedAt: Date.now(),
      },
    ]);
    editorServiceMock.loadTextFile.mockClear();

    await component.ngOnInit();

    expect(component.code()).toBe('restored draft');
    expect(component.currentFileName()).toBe('draft.js');
    expect(component.isDirty()).toBe(true);
    expect(component.saveStatus()).toBe('draftSavedLocally');
    expect(editorServiceMock.loadTextFile).not.toHaveBeenCalled();
  });
});
