import { Injectable, inject } from '@angular/core';
import type { editor } from 'monaco-editor';
import { FileContentService } from '@libs-wifi-data-access';

/**
 * エディターサービス
 *
 * Monaco Editor の管理とファイル編集機能を担当
 * porting/services/editor.service.ts から移行・完成
 */
@Injectable({
  providedIn: 'root',
})
export class EditorService {
  private editor: editor.IStandaloneCodeEditor | null = null;
  private editedFlag = false;
  private saveDisabled = false;
  private fileContent = inject(FileContentService);

  /**
   * Monaco Editor を初期化
   *
   * @param container エディターのコンテナ要素
   * @param options エディターオプション
   */
  initializeEditor(editorInstance: editor.IStandaloneCodeEditor): void {
    this.editor = editorInstance;
    this.editor.onDidChangeModelContent((event) => {
      if (event.isFlush) {
        return;
      }
      this.editedFlag = true;
    });
  }

  /**
   * デバイス上のテキストファイルを読み込みます。
   */
  async loadTextFile(path: string): Promise<string> {
    const info = await this.fileContent.readFile(path);
    if (!info.isText || typeof info.content !== 'string') {
      throw new Error('Target file is not a text file');
    }
    return info.content;
  }

  /**
   * デバイス上のテキストファイルを保存します。
   */
  async saveTextFile(path: string, content: string): Promise<void> {
    await this.fileContent.writeTextFile(path, content);
  }
}
