/**
 * Editor / file transfer text metadata and size limits (Issue #813).
 */

/** Line ending style preserved across load/save. */
export type TextLineEnding = 'lf' | 'crlf';

/**
 * Metadata captured when loading a text file from the device.
 * Editing uses a normalized LF string; save re-applies these fields.
 */
export interface TextFileMeta {
  /** Always UTF-8 for editable text files. */
  encoding: 'utf-8';
  /** Whether the on-disk file had a UTF-8 BOM. */
  bom: boolean;
  /** Original line ending style. */
  lineEnding: TextLineEnding;
  /** Whether the original file ended with a newline. */
  trailingNewline: boolean;
}

/** Default meta for newly created files (LF, no BOM, trailing newline). */
export const DEFAULT_NEW_TEXT_FILE_META: TextFileMeta = {
  encoding: 'utf-8',
  bom: false,
  lineEnding: 'lf',
  trailingNewline: true,
};

/** Warn before opening files at or above this UTF-8 byte size. */
export const EDITOR_FILE_WARN_BYTES = 256 * 1024;

/** Hard limit: refuse to open files above this UTF-8 byte size. */
export const EDITOR_FILE_MAX_BYTES = 1024 * 1024;

/**
 * ファイル内容情報
 */
export interface FileContentInfo {
  content: string | ArrayBuffer;
  isText: boolean;
  /** UTF-8 byte length on disk (or buffer byteLength for binary). */
  size: number;
  encoding?: string;
  /** Present for successfully decoded text files. */
  meta?: TextFileMeta;
}

/** Options for chunked file transfers. */
export interface FileTransferOptions {
  onProgress?: (percent: number) => void;
}
