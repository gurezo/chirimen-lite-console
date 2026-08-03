import { FileUtils } from './file.utils';

describe('FileUtils heredoc helpers', () => {
  describe('chooseHeredocDelimiter', () => {
    it('uses CHIRIMEN_EOF when content has no collision', () => {
      expect(FileUtils.chooseHeredocDelimiter('hello\nEOL\nworld')).toBe(
        'CHIRIMEN_EOF',
      );
    });

    it('increments suffix when CHIRIMEN_EOF appears as a line', () => {
      expect(
        FileUtils.chooseHeredocDelimiter('before\nCHIRIMEN_EOF\nafter'),
      ).toBe('CHIRIMEN_EOF_0');
    });

    it('skips occupied numbered suffixes', () => {
      const content = ['CHIRIMEN_EOF', 'CHIRIMEN_EOF_0', 'body'].join('\n');
      expect(FileUtils.chooseHeredocDelimiter(content)).toBe('CHIRIMEN_EOF_1');
    });
  });

  describe('generateHeredocCommand', () => {
    it('keeps full content when body contains an EOL line', () => {
      const content = [
        '#!/bin/sh',
        'sudo sh -c "cat > /tmp/x" <<EOL',
        'ssid=test',
        'EOL',
        'echo done',
      ].join('\n');

      const command = FileUtils.generateHeredocCommand('/tmp/wifi_setup.sh', content);

      expect(command).toContain(`<< 'CHIRIMEN_EOF'`);
      expect(command.endsWith('\nCHIRIMEN_EOF')).toBe(true);
      expect(command).toContain(content);
      // outer delimiter must not be the colliding EOL used inside the script
      expect(command).not.toMatch(/<< 'EOL'/);
    });

    it('escapes the target path', () => {
      const command = FileUtils.generateHeredocCommand('/tmp/a b.sh', 'x');
      expect(command.startsWith(`cat > ${FileUtils.escapePath('/tmp/a b.sh')}`)).toBe(
        true,
      );
    });
  });

  describe('generateAppendCommand', () => {
    it('uses a collision-safe delimiter', () => {
      const content = 'line\nCHIRIMEN_EOF\nmore';
      const command = FileUtils.generateAppendCommand('notes.txt', content);
      expect(command).toContain(`<< 'CHIRIMEN_EOF_0'`);
      expect(command).toContain(content);
    });
  });
});

describe('FileUtils atomic save helpers', () => {
  describe('buildTempSavePath', () => {
    it('places a hidden temp file in the same directory', () => {
      expect(FileUtils.buildTempSavePath('/home/pi/app.js', 'abc')).toBe(
        '/home/pi/.app.js.chirimen-saving.abc',
      );
    });

    it('supports relative paths without a directory', () => {
      expect(FileUtils.buildTempSavePath('edited.js', 'xyz')).toBe(
        '.edited.js.chirimen-saving.xyz',
      );
    });

    it('keeps spaces and unicode in the basename', () => {
      expect(
        FileUtils.buildTempSavePath('/tmp/日本語 file.js', 's1'),
      ).toBe('/tmp/.日本語 file.js.chirimen-saving.s1');
    });
  });

  describe('utf8ByteLength', () => {
    it('counts ascii as one byte per character', () => {
      expect(FileUtils.utf8ByteLength('abc')).toBe(3);
    });

    it('counts multibyte characters correctly', () => {
      expect(FileUtils.utf8ByteLength('日本語')).toBe(9);
    });
  });

  describe('generateByteSizeCommand', () => {
    it('escapes the path for wc -c', () => {
      const command = FileUtils.generateByteSizeCommand('/tmp/a b.js');
      expect(command).toBe(
        `wc -c -- ${FileUtils.escapePath('/tmp/a b.js')}`,
      );
    });
  });

  describe('parseByteSizeOutput', () => {
    it('parses wc -c output with a path', () => {
      expect(FileUtils.parseByteSizeOutput('12 /tmp/file.js\n')).toBe(12);
    });

    it('parses a bare number', () => {
      expect(FileUtils.parseByteSizeOutput('0\n')).toBe(0);
    });

    it('returns null when no size is found', () => {
      expect(FileUtils.parseByteSizeOutput('error: missing\n')).toBeNull();
    });
  });
});
