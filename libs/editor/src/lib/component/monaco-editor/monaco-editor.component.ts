import {
  Component,
  effect,
  output,
  input,
  model,
  untracked,
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
})
export class MonacoEditorComponent {
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

  constructor() {
    effect(() => {
      const options = this.editorOptions();
      const instance = untracked(() => this.editorInstance);
      if (!instance) {
        return;
      }
      this.applyEditorOptions(instance, options);
    });
  }

  onEditorInit(editorInstance: editor.IStandaloneCodeEditor): void {
    this.editorInstance = editorInstance;
    this.applyEditorOptions(editorInstance, this.editorOptions());
    this.editorInitialized.emit(editorInstance);
    editorInstance.onDidChangeModelContent((event) => {
      if (event.isFlush) {
        return;
      }
      this.contentEdited.emit();
    });
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
