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
