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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call layout when the container resizes', () => {
    const layout = vi.fn();
    const editorInstance = {
      layout,
      updateOptions: vi.fn(),
      getModel: () => null,
      onDidChangeModelContent: vi.fn(),
    } as unknown as editor.IStandaloneCodeEditor;

    component.onEditorInit(editorInstance);

    expect(observeSpy).toHaveBeenCalled();
    expect(layout).toHaveBeenCalled();

    layout.mockClear();
    resizeCallback?.(
      [] as unknown as ResizeObserverEntry[],
      {} as ResizeObserver,
    );
    expect(layout).toHaveBeenCalledTimes(1);
  });

  it('should disconnect ResizeObserver on destroy', () => {
    const layout = vi.fn();
    const editorInstance = {
      layout,
      updateOptions: vi.fn(),
      getModel: () => null,
      onDidChangeModelContent: vi.fn(),
    } as unknown as editor.IStandaloneCodeEditor;

    component.onEditorInit(editorInstance);
    fixture.destroy();

    expect(disconnectSpy).toHaveBeenCalled();
  });
});
