/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConsoleShellStore } from '@libs-console-shell';
import { provideMonacoEditor } from 'ngx-monaco-editor-v2';
import { EditorService } from '../../service';
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

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [EditorPageComponent],
      providers: [provideMonacoEditor({})],
    })
      .overrideProvider(EditorService, { useValue: editorServiceMock })
      .overrideProvider(ConsoleShellStore, { useValue: shellStoreMock })
      .compileComponents();

    fixture = TestBed.createComponent(EditorPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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
  });

  it('should skip save when dirty state is false', async () => {
    component.isDirty.set(false);

    await component.saveCurrentFile();

    expect(editorServiceMock.saveTextFile).not.toHaveBeenCalled();
  });
});
