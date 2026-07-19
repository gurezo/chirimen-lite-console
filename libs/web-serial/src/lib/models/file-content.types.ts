/**
 * ファイル内容情報
 */
export interface FileContentInfo {
  content: string | ArrayBuffer;
  isText: boolean;
  size: number;
  encoding?: string;
}
