import { DEFAULT_NEW_TEXT_FILE_META } from '../models/file-content.types';
import {
  NonUtf8TextError,
  decodeUtf8Fatal,
  detectLineEnding,
  isNonUtf8TextError,
  normalizeToLf,
  parseTextFileBytes,
  serializeTextFileForSave,
} from './text-file-codec';

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

describe('text-file-codec', () => {
  describe('decodeUtf8Fatal', () => {
    it('decodes japanese emoji and combining characters', () => {
      const text = '日本語 🍣 e\u0301';
      expect(decodeUtf8Fatal(encode(text))).toBe(text);
    });

    it('throws NonUtf8TextError for invalid sequences', () => {
      expect(() => decodeUtf8Fatal(new Uint8Array([0xff, 0xfe, 0xfd]))).toThrow(
        NonUtf8TextError,
      );
      try {
        decodeUtf8Fatal(new Uint8Array([0xff]));
      } catch (error) {
        expect(isNonUtf8TextError(error)).toBe(true);
      }
    });
  });

  describe('parseTextFileBytes', () => {
    it('detects LF without BOM and trailing newline', () => {
      const { editorText, meta } = parseTextFileBytes(encode('a\nb\n'));
      expect(editorText).toBe('a\nb\n');
      expect(meta).toEqual({
        encoding: 'utf-8',
        bom: false,
        lineEnding: 'lf',
        trailingNewline: true,
      });
    });

    it('detects CRLF and preserves meta while normalizing editor text to LF', () => {
      const { editorText, meta } = parseTextFileBytes(encode('a\r\nb\r\n'));
      expect(editorText).toBe('a\nb\n');
      expect(meta.lineEnding).toBe('crlf');
      expect(meta.trailingNewline).toBe(true);
    });

    it('detects UTF-8 BOM and strips it from editor text', () => {
      const { editorText, meta } = parseTextFileBytes(encode('\uFEFFhello'));
      expect(editorText).toBe('hello');
      expect(meta.bom).toBe(true);
      expect(meta.trailingNewline).toBe(false);
    });

    it('detects missing trailing newline', () => {
      const { meta } = parseTextFileBytes(encode('no-nl'));
      expect(meta.trailingNewline).toBe(false);
    });
  });

  describe('serializeTextFileForSave', () => {
    it('round-trips CRLF with BOM and trailing newline', () => {
      const original = '\uFEFFline1\r\nline2\r\n';
      const { editorText, meta } = parseTextFileBytes(encode(original));
      expect(serializeTextFileForSave(editorText, meta)).toBe(original);
    });

    it('round-trips LF without trailing newline', () => {
      const original = 'a\nb';
      const { editorText, meta } = parseTextFileBytes(encode(original));
      expect(serializeTextFileForSave(editorText, meta)).toBe(original);
    });

    it('uses new-file defaults for LF with trailing newline', () => {
      expect(
        serializeTextFileForSave('hello', DEFAULT_NEW_TEXT_FILE_META),
      ).toBe('hello\n');
    });

    it('does not convert LF content to CRLF when meta is lf', () => {
      const saved = serializeTextFileForSave('a\nb\n', {
        encoding: 'utf-8',
        bom: false,
        lineEnding: 'lf',
        trailingNewline: true,
      });
      expect(saved).toBe('a\nb\n');
      expect(saved.includes('\r')).toBe(false);
    });
  });

  describe('detectLineEnding / normalizeToLf', () => {
    it('defaults to lf when no CRLF is present', () => {
      expect(detectLineEnding('a\nb')).toBe('lf');
      expect(detectLineEnding('')).toBe('lf');
    });

    it('normalizes lone CR to LF', () => {
      expect(normalizeToLf('a\rb\n')).toBe('a\nb\n');
    });
  });
});
