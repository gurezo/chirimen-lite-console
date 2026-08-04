import type { TextFileMeta, TextLineEnding } from '../models/file-content.types';

const UTF8_BOM = '\uFEFF';

export class NonUtf8TextError extends Error {
  readonly code = 'NON_UTF8_TEXT' as const;

  constructor(message = 'File is not valid UTF-8') {
    super(message);
    this.name = 'NonUtf8TextError';
  }
}

export function isNonUtf8TextError(error: unknown): error is NonUtf8TextError {
  return (
    error instanceof NonUtf8TextError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === 'NON_UTF8_TEXT')
  );
}

/** UTF-8 BOM byte sequence (EF BB BF). */
const UTF8_BOM_BYTES = new Uint8Array([0xef, 0xbb, 0xbf]);

export function hasUtf8Bom(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 3 &&
    bytes[0] === UTF8_BOM_BYTES[0] &&
    bytes[1] === UTF8_BOM_BYTES[1] &&
    bytes[2] === UTF8_BOM_BYTES[2]
  );
}

/**
 * Decode bytes as UTF-8 (fatal). Throws {@link NonUtf8TextError} on invalid sequences.
 * Note: TextDecoder strips a leading UTF-8 BOM from the returned string.
 */
export function decodeUtf8Fatal(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new NonUtf8TextError();
  }
}

/**
 * Detect BOM / line ending / trailing newline, strip BOM, and normalize EOLs to LF
 * for Monaco editing. Original style is retained in {@link TextFileMeta}.
 */
export function parseTextFileBytes(bytes: Uint8Array): {
  editorText: string;
  meta: TextFileMeta;
  utf8ByteLength: number;
} {
  const bom = hasUtf8Bom(bytes);
  // TextDecoder removes BOM from the string; detect it from raw bytes first.
  const withoutBomBytes = bom ? bytes.subarray(3) : bytes;
  const withoutBom = decodeUtf8Fatal(withoutBomBytes);
  const lineEnding = detectLineEnding(withoutBom);
  const trailingNewline = /(?:\r\n|\n|\r)$/.test(withoutBom);
  const editorText = normalizeToLf(withoutBom);

  return {
    editorText,
    meta: {
      encoding: 'utf-8',
      bom,
      lineEnding,
      trailingNewline,
    },
    utf8ByteLength: bytes.byteLength,
  };
}

/**
 * Re-apply BOM / EOL / trailing-newline policy to editor LF text before save.
 */
export function serializeTextFileForSave(
  editorText: string,
  meta: TextFileMeta,
): string {
  let body = normalizeToLf(editorText);

  const endsWithNewline = body.endsWith('\n');
  if (meta.trailingNewline && !endsWithNewline) {
    body += '\n';
  } else if (!meta.trailingNewline && endsWithNewline) {
    body = body.replace(/\n+$/, '');
  }

  if (meta.lineEnding === 'crlf') {
    body = body.replace(/\n/g, '\r\n');
  }

  if (meta.bom) {
    body = UTF8_BOM + body;
  }

  return body;
}

export function detectLineEnding(text: string): TextLineEnding {
  if (text.includes('\r\n')) {
    return 'crlf';
  }
  return 'lf';
}

export function normalizeToLf(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
