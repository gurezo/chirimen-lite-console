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

  /**
   * Heredoc write. `content` must already end with `\n` so the delimiter line
   * does not inject an extra blank line (preserves a single trailing newline).
   */
  static generateHeredocCommand(fileName: string, content: string): string {
    const delimiter = FileUtils.chooseHeredocDelimiter(content);
    const path = FileUtils.escapePath(fileName);
    const body = content.endsWith('\n') ? content : `${content}\n`;
    return `cat > ${path} << '${delimiter}'\n${body}${delimiter}`;
  }

  static generateAppendCommand(fileName: string, content: string): string {
    const delimiter = FileUtils.chooseHeredocDelimiter(content);
    const path = FileUtils.escapePath(fileName);
    const body = content.endsWith('\n') ? content : `${content}\n`;
    return `cat >> ${path} << '${delimiter}'\n${body}${delimiter}`;
  }

  /** True when heredoc cannot preserve exact bytes (CRLF, BOM, or no trailing NL). */
  static requiresExactByteWrite(content: string): boolean {
    return (
      content.includes('\r') ||
      content.startsWith('\uFEFF') ||
      !content.endsWith('\n')
    );
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

  /**
   * 同一ディレクトリ上の一時保存パスを生成する（`mv` で atomic 置換するため）。
   */
  static buildTempSavePath(
    targetPath: string,
    suffix: string = FileUtils.createTempSaveSuffix(),
  ): string {
    const dir = FileUtils.getDirectoryPath(targetPath);
    const base = FileUtils.getFileName(targetPath);
    const tempName = `.${base}.chirimen-saving.${suffix}`;
    return dir === '.' ? tempName : `${dir}/${tempName}`;
  }

  static createTempSaveSuffix(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /** UTF-8 バイト長（シリアル転送・サイズ検証用） */
  static utf8ByteLength(content: string): number {
    return new TextEncoder().encode(content).byteLength;
  }

  /**
   * heredoc ではなくチャンク転送へ切り替えるサイズしきい値（UTF-8 バイト）。
   */
  static readonly TEXT_CHUNK_THRESHOLD_BYTES = 16 * 1024;

  static generateByteSizeCommand(path: string): string {
    return `wc -c -- ${FileUtils.escapePath(path)}`;
  }

  /**
   * `wc -c -- path` の stdout からバイト数を取り出す。
   * 例: `12 /path/to/file` / `12`
   */
  static parseByteSizeOutput(stdout: string): number | null {
    const cleaned = String(stdout)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of cleaned) {
      const match = /^(\d+)\b/.exec(line);
      if (match) {
        return Number(match[1]);
      }
    }
    return null;
  }
}
