/**
 * ファイル操作ユーティリティ
 *
 * porting/utils/file-utils.ts から移行
 */
export class FileUtils {
  /**
   * テキストファイルの拡張子リスト
   */
  static readonly TEXT_FILE_EXTENSIONS = [
    '.txt',
    '.sh',
    '.csv',
    '.tsv',
    '.js',
    '.conf',
    '.mjs',
    '.md',
    '.yml',
    '.xml',
    '.html',
    '.htm',
    '.json',
    '.py',
    '.php',
    '.log',
    '.ts',
    '.tsx',
    '.jsx',
    '.css',
    '.scss',
    '.sass',
    '.less',
  ];

  static isTextFile(path: string): boolean {
    const lastSlashIndex = path.lastIndexOf('/');
    const fileName =
      lastSlashIndex >= 0 ? path.substring(lastSlashIndex + 1) : path;
    const lastDotIndex = fileName.lastIndexOf('.');

    if (lastDotIndex === -1) {
      return true;
    }
    if (lastDotIndex === 0) {
      return true;
    }

    const extension = fileName.substring(lastDotIndex);
    return this.TEXT_FILE_EXTENSIONS.includes(extension);
  }

  static getFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === 0) {
      return '';
    }
    return fileName.substring(lastDotIndex);
  }

  static getFileNameWithoutExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === 0) {
      return fileName;
    }
    return fileName.substring(0, lastDotIndex);
  }

  static getFileName(path: string): string {
    const lastSlashIndex = path.lastIndexOf('/');
    return lastSlashIndex >= 0 ? path.substring(lastSlashIndex + 1) : path;
  }

  static getDirectoryPath(path: string): string {
    const lastSlashIndex = path.lastIndexOf('/');
    return lastSlashIndex >= 0 ? path.substring(0, lastSlashIndex) : '.';
  }

  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * 本文に現れない heredoc 終端を選ぶ（固定 `EOL` は内容中の `EOL` 行と衝突する）。
   */
  static chooseHeredocDelimiter(content: string): string {
    const base = 'CHIRIMEN_EOF';
    if (!FileUtils.contentHasDelimiterLine(content, base)) {
      return base;
    }
    let n = 0;
    while (FileUtils.contentHasDelimiterLine(content, `${base}_${n}`)) {
      n += 1;
    }
    return `${base}_${n}`;
  }

  private static contentHasDelimiterLine(
    content: string,
    delimiter: string,
  ): boolean {
    return content.split(/\r?\n/).some((line) => line === delimiter);
  }

  static generateHeredocCommand(fileName: string, content: string): string {
    const delimiter = FileUtils.chooseHeredocDelimiter(content);
    const path = FileUtils.escapePath(fileName);
    return `cat > ${path} << '${delimiter}'\n${content}\n${delimiter}`;
  }

  static generateAppendCommand(fileName: string, content: string): string {
    const delimiter = FileUtils.chooseHeredocDelimiter(content);
    const path = FileUtils.escapePath(fileName);
    return `cat >> ${path} << '${delimiter}'\n${content}\n${delimiter}`;
  }

  static generateBase64SaveCommand(fileName: string): string {
    return `base64 -d > ${fileName}`;
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
  }

  static escapePath(path: string): string {
    const jsonString = JSON.stringify(String(path));
    return jsonString.replace(/^"/, `$$'`).replace(/"$/, `'`);
  }
}
