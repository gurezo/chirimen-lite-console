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
  imports: [MonacoEditorModule],
  templateUrl: './monaco-editor.component.html',
  host: {
    class: 'block h-full min-h-0 min-w-0',
  },
  styles: `
    :host {
      display: block;
      height: 100%;
      min-height: 0;
      min-width: 0;
    }

    /* ngx-monaco-editor-v2 hardcodes :host { height: 200px }; override so the
       editor fills the flex panel instead of looking empty/clipped. */
    ngx-monaco-editor {
      display: block;
      height: 100% !important;
      min-height: 0;
      min-width: 0;
      flex: 1 1 0%;
    }
  `,
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

  /**
   * Stable options for ngx-monaco-editor-v2. That library reinits (dispose +
   * recreate) whenever the `[options]` input identity changes; language and
   * readOnly are applied in-place via {@link applyEditorOptions} instead.
   */
  readonly baseEditorOptions: MonacoEditorOptions = {
    theme: 'vs-dark',
    automaticLayout: true,
  };

  private editorInstance: editor.IStandaloneCodeEditor | null = null;
  private resizeObserver?: ResizeObserver;
  /** Skip echoing setValue-driven model changes back into the code model. */
  private applyingExternalValue = false;

  constructor() {
    // Push parent/model code into Monaco directly. ngx-monaco-editor-v2's
    // ngModel writeValue uses setTimeout and races with dispose/reinit,
    // which can leave the buffer empty after a successful file load.
    effect(() => {
      const value = this.code();
      const instance = untracked(() => this.editorInstance);
      if (!instance) {
        return;
      }
      this.syncValueToEditor(instance, value);
    });

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
    this.syncValueToEditor(editorInstance, this.code());
    this.bindPageOwnedShortcuts(editorInstance);
    this.editorInitialized.emit(editorInstance);
    this.observeContainerResize(editorInstance);
    editorInstance.onDidChangeModelContent((event) => {
      if (event.isFlush || this.applyingExternalValue) {
        return;
      }
      const next = editorInstance.getValue();
      if (next !== this.code()) {
        this.code.set(next);
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

  private syncValueToEditor(
    instance: editor.IStandaloneCodeEditor,
    value: string,
  ): void {
    if (instance.getValue() === value) {
      return;
    }
    this.applyingExternalValue = true;
    try {
      instance.setValue(value);
    } finally {
      this.applyingExternalValue = false;
    }
    try {
      instance.layout();
    } catch {
      // Dimensions may be zero before layout stabilizes
    }
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
