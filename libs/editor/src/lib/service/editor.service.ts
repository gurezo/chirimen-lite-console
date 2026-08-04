import { Injectable, inject } from '@angular/core';
import type { editor } from 'monaco-editor';
import {
  classifyFileWriteError,
  FileContentService,
  type FileTransferOptions,
  SerialFacadeService,
  serializeTextFileForSave,
  type TextFileMeta,
  type TextLineEnding,
} from '@libs-web-serial';

export interface EditorLoadedTextFile {
  content: string;
  meta: TextFileMeta;
  size: number;
}

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

  /** Remote UTF-8 byte size (`wc -c`) for large-file preflight. */
  async getByteSize(path: string): Promise<number> {
    return this.fileContent.getByteSize(path);
  }

  /**
   * デバイス上のテキストファイルを読み込みます。
   */
  async loadTextFile(path: string): Promise<EditorLoadedTextFile> {
    const info = await this.fileContent.readFile(path);
    if (!info.isText || typeof info.content !== 'string' || !info.meta) {
      throw new Error('Target file is not a text file');
    }
    return {
      content: info.content,
      meta: info.meta,
      size: info.size,
    };
  }

  /**
   * デバイス上のテキストファイルを安全に保存します。
   * 未接続時は実ファイルへ書き込まず失敗します。
   * `editorContent` は Monaco 上の LF 正規化テキスト。`meta` で BOM/EOL を再適用する。
   */
  async saveTextFile(
    path: string,
    editorContent: string,
    meta: TextFileMeta,
    options?: FileTransferOptions,
  ): Promise<void> {
    if (!this.serial.isConnected()) {
      throw classifyFileWriteError(new Error('not connected'));
    }

    const payload = serializeTextFileForSave(editorContent, meta);

    try {
      await this.fileContent.writeTextFile(path, payload, options);
    } catch (error: unknown) {
      throw classifyFileWriteError(error);
    }
  }

  /** Abort in-flight serial commands used by load/save transfers. */
  cancelTransfer(): void {
    this.serial.cancelAllCommands();
  }

  /** Apply Monaco model EOL to match preserved file meta. */
  applyLineEnding(lineEnding: TextLineEnding): void {
    const model = this.editor?.getModel();
    if (!model || typeof monaco === 'undefined') {
      return;
    }
    const sequence =
      lineEnding === 'crlf'
        ? monaco.editor.EndOfLineSequence.CRLF
        : monaco.editor.EndOfLineSequence.LF;
    model.setEOL(sequence);
  }

  /**
   * Monaco の Document Format Action を実行します。
   * Formatter が無い／未対応の場合は false を返します。
   */
  async formatDocument(): Promise<boolean> {
    if (!this.editor) {
      return false;
    }

    const action = this.editor.getAction('editor.action.formatDocument');
    if (!action || !action.isSupported()) {
      return false;
    }

    await action.run();
    return true;
  }

  /** 現在の Monaco バッファ内容。未初期化時は null。 */
  getValue(): string | null {
    return this.editor?.getValue() ?? null;
  }
}

declare const monaco: {
  editor: {
    EndOfLineSequence: {
      LF: number;
      CRLF: number;
    };
  };
};
