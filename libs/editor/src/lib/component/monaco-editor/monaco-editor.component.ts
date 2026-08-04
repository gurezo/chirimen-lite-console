import {
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  output,
  input,
  model,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import type { editor } from 'monaco-editor';

export type MonacoEditorOptions = {
  theme?: string;
  language?: string;
  automaticLayout?: boolean;
  readOnly?: boolean;
};

declare const monaco: {
  KeyMod: {
    CtrlCmd: number;
    Shift: number;
    Alt: number;
  };
  KeyCode: {
    KeyS: number;
    KeyF: number;
  };
  editor: {
    setModelLanguage: (
      model: editor.ITextModel,
      languageId: string,
    ) => void;
  };
};

@Component({
  selector: 'choh-monaco-editor',
  imports: [FormsModule, MonacoEditorModule],
  templateUrl: './monaco-editor.component.html',
  host: {
    class: 'block h-full min-h-0 min-w-0',
  },
})
export class MonacoEditorComponent {
  private readonly destroyRef = inject(DestroyRef);

  private readonly hostRef = viewChild.required<ElementRef<HTMLElement>>(
    'monacoHost',
  );

  code = model<string>('');
  contentEdited = output<void>();
  editorInitialized = output<editor.IStandaloneCodeEditor>();

  editorOptions = input<MonacoEditorOptions>({
    theme: 'vs-dark',
    language: 'javascript',
    automaticLayout: true,
    readOnly: false,
  });

  private editorInstance: editor.IStandaloneCodeEditor | null = null;
  private resizeObserver?: ResizeObserver;

  constructor() {
    effect(() => {
      const options = this.editorOptions();
      const instance = untracked(() => this.editorInstance);
      if (!instance) {
        return;
      }
      this.applyEditorOptions(instance, options);
    });

    this.destroyRef.onDestroy(() => this.teardownResizeObserver());
  }

  onEditorInit(editorInstance: editor.IStandaloneCodeEditor): void {
    this.editorInstance = editorInstance;
    this.applyEditorOptions(editorInstance, this.editorOptions());
    this.bindPageOwnedShortcuts(editorInstance);
    this.editorInitialized.emit(editorInstance);
    this.observeContainerResize(editorInstance);
    editorInstance.onDidChangeModelContent((event) => {
      if (event.isFlush) {
        return;
      }
      this.contentEdited.emit();
    });
  }

  /**
   * Steal Ctrl/Cmd+S and Shift+Alt/Option+F from Monaco so EditorPage's
   * window:keydown handler remains the single owner (avoids double format /
   * browser save dialog conflicts).
   */
  private bindPageOwnedShortcuts(
    editorInstance: editor.IStandaloneCodeEditor,
  ): void {
    if (typeof monaco === 'undefined') {
      return;
    }
    const noop = (): void => undefined;
    editorInstance.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      noop,
    );
    editorInstance.addCommand(
      monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
      noop,
    );
  }

  private observeContainerResize(
    editorInstance: editor.IStandaloneCodeEditor,
  ): void {
    this.teardownResizeObserver();
    const host = this.hostRef().nativeElement;
    this.resizeObserver = new ResizeObserver(() => {
      try {
        editorInstance.layout();
      } catch {
        // Dimensions may be zero before layout stabilizes
      }
    });
    this.resizeObserver.observe(host);
    try {
      editorInstance.layout();
    } catch {
      // Dimensions may be zero before layout stabilizes
    }
  }

  private teardownResizeObserver(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  }

  private applyEditorOptions(
    instance: editor.IStandaloneCodeEditor,
    options: MonacoEditorOptions,
  ): void {
    instance.updateOptions({
      readOnly: options.readOnly ?? false,
    });
    const language = options.language;
    const model = instance.getModel();
    if (language && model && typeof monaco !== 'undefined') {
      monaco.editor.setModelLanguage(model, language);
    }
  }
}
