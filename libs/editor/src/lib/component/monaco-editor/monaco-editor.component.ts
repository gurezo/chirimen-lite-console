import { Component, output, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import type { editor } from 'monaco-editor';

@Component({
  selector: 'choh-monaco-editor',
  imports: [FormsModule, MonacoEditorModule],
  templateUrl: './monaco-editor.component.html',
})
export class MonacoEditorComponent {
  code = model<string>('');
  contentEdited = output<void>();
  editorInitialized = output<editor.IStandaloneCodeEditor>();

  editorOptions = input({
    theme: 'vs-dark',
    language: 'javascript',
    automaticLayout: true,
  });

  onEditorInit(editorInstance: editor.IStandaloneCodeEditor): void {
    this.editorInitialized.emit(editorInstance);
    editorInstance.onDidChangeModelContent((event) => {
      if (event.isFlush) {
        return;
      }
      this.contentEdited.emit();
    });
  }
}
