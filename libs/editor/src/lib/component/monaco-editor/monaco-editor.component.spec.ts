/// <reference types="vitest/globals" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMonacoEditor } from 'ngx-monaco-editor-v2';
import type { editor } from 'monaco-editor';
import { MonacoEditorComponent } from './monaco-editor.component';

describe('MonacoEditorComponent', () => {
  let component: MonacoEditorComponent;
  let fixture: ComponentFixture<MonacoEditorComponent>;
  let resizeCallback: ResizeObserverCallback | undefined;
  let observeSpy: ReturnType<typeof vi.fn>;
  let disconnectSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    observeSpy = vi.fn();
    disconnectSpy = vi.fn();
    resizeCallback = undefined;

    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }
        observe = observeSpy;
        unobserve = vi.fn();
        disconnect = disconnectSpy;
      },
    );

    await TestBed.configureTestingModule({
      imports: [MonacoEditorComponent],
      providers: [provideMonacoEditor({})],
    }).compileComponents();

    fixture = TestBed.createComponent(MonacoEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createEditorMock(
    overrides: Partial<{
      getValue: ReturnType<typeof vi.fn>;
      setValue: ReturnType<typeof vi.fn>;
      layout: ReturnType<typeof vi.fn>;
      updateOptions: ReturnType<typeof vi.fn>;
      getModel: ReturnType<typeof vi.fn>;
      onDidChangeModelContent: ReturnType<typeof vi.fn>;
      addCommand: ReturnType<typeof vi.fn>;
    }> = {},
  ): editor.IStandaloneCodeEditor {
    return {
      getValue: overrides.getValue ?? vi.fn().mockReturnValue(''),
      setValue: overrides.setValue ?? vi.fn(),
      layout: overrides.layout ?? vi.fn(),
      updateOptions: overrides.updateOptions ?? vi.fn(),
      getModel: overrides.getModel ?? vi.fn().mockReturnValue(null),
      onDidChangeModelContent:
        overrides.onDidChangeModelContent ?? vi.fn(),
      addCommand: overrides.addCommand ?? vi.fn(),
    } as unknown as editor.IStandaloneCodeEditor;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose a stable baseEditorOptions reference for ngx', () => {
    const first = component.baseEditorOptions;
    fixture.componentRef.setInput('editorOptions', {
      theme: 'vs-dark',
      language: 'markdown',
      automaticLayout: true,
      readOnly: true,
    });
    fixture.detectChanges();

    expect(component.baseEditorOptions).toBe(first);
    expect(component.baseEditorOptions).toEqual({
      theme: 'vs-dark',
      automaticLayout: true,
    });
    expect(component.baseEditorOptions).not.toHaveProperty('language');
    expect(component.baseEditorOptions).not.toHaveProperty('readOnly');
  });

  it('should soft-apply language and readOnly when editorOptions change', () => {
    const setModelLanguage = vi.fn();
    vi.stubGlobal('monaco', {
      KeyMod: { CtrlCmd: 2048, Shift: 1024, Alt: 512 },
      KeyCode: { KeyS: 49, KeyF: 36 },
      editor: { setModelLanguage },
    });

    const updateOptions = vi.fn();
    const model = {} as editor.ITextModel;
    const editorInstance = createEditorMock({
      updateOptions,
      getModel: vi.fn().mockReturnValue(model),
    });

    component.onEditorInit(editorInstance);
    updateOptions.mockClear();
    setModelLanguage.mockClear();

    fixture.componentRef.setInput('editorOptions', {
      theme: 'vs-dark',
      language: 'javascript',
      automaticLayout: true,
      readOnly: true,
    });
    fixture.detectChanges();

    expect(updateOptions).toHaveBeenCalledWith({ readOnly: true });
    expect(setModelLanguage).toHaveBeenCalledWith(model, 'javascript');
  });

  it('should push code into monaco via setValue when code model changes', () => {
    vi.stubGlobal('monaco', {
      KeyMod: { CtrlCmd: 2048, Shift: 1024, Alt: 512 },
      KeyCode: { KeyS: 49, KeyF: 36 },
      editor: { setModelLanguage: vi.fn() },
    });

    const getValue = vi.fn().mockReturnValue('');
    const setValue = vi.fn();
    const editorInstance = createEditorMock({ getValue, setValue });

    component.onEditorInit(editorInstance);
    setValue.mockClear();
    getValue.mockReturnValue('');

    fixture.componentRef.setInput('code', "console.log('hello');\n");
    fixture.detectChanges();

    expect(setValue).toHaveBeenCalledWith("console.log('hello');\n");
  });

  it('should sync current code on editor init', () => {
    vi.stubGlobal('monaco', {
      KeyMod: { CtrlCmd: 2048, Shift: 1024, Alt: 512 },
      KeyCode: { KeyS: 49, KeyF: 36 },
      editor: { setModelLanguage: vi.fn() },
    });

    fixture.componentRef.setInput('code', 'preloaded');
    fixture.detectChanges();

    const setValue = vi.fn();
    const editorInstance = createEditorMock({
      getValue: vi.fn().mockReturnValue(''),
      setValue,
    });

    component.onEditorInit(editorInstance);

    expect(setValue).toHaveBeenCalledWith('preloaded');
  });

  it('should call layout when the container resizes', () => {
    vi.stubGlobal('monaco', {
      KeyMod: { CtrlCmd: 2048, Shift: 1024, Alt: 512 },
      KeyCode: { KeyS: 49, KeyF: 36 },
      editor: { setModelLanguage: vi.fn() },
    });

    const layout = vi.fn();
    const addCommand = vi.fn();
    const editorInstance = createEditorMock({ layout, addCommand });

    component.onEditorInit(editorInstance);

    expect(observeSpy).toHaveBeenCalled();
    expect(layout).toHaveBeenCalled();
    expect(addCommand).toHaveBeenCalledTimes(2);

    layout.mockClear();
    resizeCallback?.(
      [] as unknown as ResizeObserverEntry[],
      {} as ResizeObserver,
    );
    expect(layout).toHaveBeenCalledTimes(1);
  });

  it('should disconnect ResizeObserver on destroy', () => {
    const editorInstance = createEditorMock();

    component.onEditorInit(editorInstance);
    fixture.destroy();

    expect(disconnectSpy).toHaveBeenCalled();
  });
});
