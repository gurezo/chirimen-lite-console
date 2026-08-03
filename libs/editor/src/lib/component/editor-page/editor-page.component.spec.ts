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
    save: vi.fn(),
    clear: vi.fn(),
  };

  async function loadPath(path: string, content = 'loaded content'): Promise<void> {
    editorServiceMock.loadTextFile.mockResolvedValueOnce(content);
    selectedFilePathSignal.set(path);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    selectedFilePathSignal.set(null);
    draftServiceMock.read.mockReturnValue(null);
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

    editorServiceMock.loadTextFile.mockRejectedValueOnce(
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
    component.isDirty.set(true);
    component.code.set('updated');

    await component.saveCurrentFile();

    expect(editorServiceMock.saveTextFile).toHaveBeenCalledWith(
      '/home/pi/main.js',
      'updated',
    );
    expect(component.isDirty()).toBe(false);
    expect(draftServiceMock.clear).toHaveBeenCalled();
  });

  it('should skip save when dirty state is false', async () => {
    component.isDirty.set(false);

    await component.saveCurrentFile();

    expect(editorServiceMock.saveTextFile).not.toHaveBeenCalled();
  });

  it('should store edits as a session draft', async () => {
    await loadPath('/home/pi/main.js', 'loaded content');
    component.onCodeChange('updated draft');
    component.onContentEdited();

    expect(draftServiceMock.save).toHaveBeenCalledWith(
      '/home/pi/main.js',
      'updated draft',
    );
  });

  it('should restore a session draft before loading the remote file', async () => {
    draftServiceMock.read.mockReturnValueOnce({
      path: '/home/pi/draft.js',
      content: 'restored draft',
      dirty: true,
    });
    editorServiceMock.loadTextFile.mockClear();

    await component.ngOnInit();

    expect(component.code()).toBe('restored draft');
    expect(component.currentFileName()).toBe('draft.js');
    expect(component.isDirty()).toBe(true);
    expect(editorServiceMock.loadTextFile).not.toHaveBeenCalled();
  });
});
