import { Injectable, inject } from '@angular/core';
import type { editor } from 'monaco-editor';
import {
  classifyFileWriteError,
  FileContentService,
  SerialFacadeService,
} from '@libs-web-serial';

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
  private serial = inject(SerialFacadeService);

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
   * デバイス上のテキストファイルを安全に保存します。
   * 未接続時は実ファイルへ書き込まず失敗します。
   */
  async saveTextFile(path: string, content: string): Promise<void> {
    if (!this.serial.isConnected()) {
      throw classifyFileWriteError(new Error('not connected'));
    }

    try {
      await this.fileContent.writeTextFile(path, content);
    } catch (error: unknown) {
      throw classifyFileWriteError(error);
    }
  }
}
