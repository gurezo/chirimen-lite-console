/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConsoleShellStore } from '@libs-console-shell';
import { provideMonacoEditor } from 'ngx-monaco-editor-v2';
import { EditorDraftService, EditorService } from '../../service';
import { EditorPageComponent } from './editor-page.component';

describe('EditorPageComponent', () => {
  let component: EditorPageComponent;
  let fixture: ComponentFixture<EditorPageComponent>;
  const editorServiceMock = {
    loadTextFile: vi.fn().mockResolvedValue('loaded content'),
    saveTextFile: vi.fn().mockResolvedValue(undefined),
    initializeEditor: vi.fn(),
  };
  const shellStoreMock = {
    selectedFilePath: vi.fn(() => null),
  };
  const draftServiceMock = {
    read: vi.fn(() => null),
    save: vi.fn(),
    clear: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
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

  it('should save current file and clear dirty state', async () => {
    component.isDirty.set(true);
    component.code.set('updated');

    await component.saveCurrentFile();

    expect(editorServiceMock.saveTextFile).toHaveBeenCalledWith(
      '/home/pi/edited.js',
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

  it('should store edits as a session draft', () => {
    component.onCodeChange('updated draft');
    component.onContentEdited();

    expect(draftServiceMock.save).toHaveBeenCalledWith(
      '/home/pi/edited.js',
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
