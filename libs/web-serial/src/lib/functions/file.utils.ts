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

  static generateHeredocCommand(fileName: string, content: string): string {
    return `cat > ${fileName} << 'EOL'\n${content}\nEOL`;
  }

  static generateAppendCommand(fileName: string, content: string): string {
    return `cat >> ${fileName} << 'EOL'\n${content}\nEOL`;
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
