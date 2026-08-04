import type { TextFileMeta } from '@libs-shared';

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
