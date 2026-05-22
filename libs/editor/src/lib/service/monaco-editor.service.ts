import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class MonacoEditorService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private editor: any;
  private editedFlag = false;
  private saveDisabled = false;
  private sourcePath: { fileName?: string; dir?: string } = {};

  /**
   * ngx-monaco-editor-v2 を使った処理を実装する
   */

  // TODO: ファイルの読み込み
  // TODO: ファイルの保存
  // TODO: ファイルの新規作成
  // TODO: ファイルの削除
  // TODO: ファイルのリネーム
  // TODO: ファイルパスのパンくず

  initMonacoEditor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    monaco: any,
    container: HTMLElement,
    jsSrc: string,
    onSave: (value: string) => void,
  ) {
    this.editor = monaco.editor.create(container, {
      value: jsSrc,
      language: 'javascript',
      lineNumbers: 'on',
      roundedSelection: false,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      readOnly: false,
      theme: 'vs-dark',
    });
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S, () => {
      this.saveSource(onSave);
    });
    this.editor.onDidChangeModelContent(() => {
      this.editedFlag = true;
      // UI上のファイル名色変更などは呼び出し元で対応
    });
  }

  saveSource(onSave: (value: string) => void): string | null {
    if (this.saveDisabled) {
      return null;
    }
    if (!this.editedFlag) {
      return null;
    }
    const saveTxt = this.editor.getValue();
    onSave(saveTxt);
    this.editedFlag = false;
    return saveTxt;
  }

  format(): void {
    this.editor.getAction('editor.action.formatDocument').run();
  }

  disableSave(): void {
    this.setReadOnly(true);
    this.saveDisabled = true;
  }

  setReadOnly(readonlyOpt: boolean): void {
    this.editor.updateOptions({ readOnly: readonlyOpt });
  }

  setValue(srcTxt: string): void {
    this.editor.setValue(srcTxt);
  }
}
