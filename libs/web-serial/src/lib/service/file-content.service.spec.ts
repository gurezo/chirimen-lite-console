import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileUtils } from '../functions/file.utils';
import { FileContentService } from './file-content.service';
import { PiZeroPromptDetectorService } from './pi-zero-prompt-detector.service';
import { SerialFacadeService } from './serial-facade.service';

describe('FileContentService.writeTextFile', () => {
  let service: FileContentService;
  let exec$: ReturnType<typeof vi.fn>;
  let send$: ReturnType<typeof vi.fn>;
  let isConnected: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    exec$ = vi.fn();
    send$ = vi.fn().mockReturnValue(of(undefined));
    isConnected = vi.fn().mockReturnValue(true);

    TestBed.configureTestingModule({
      providers: [
        FileContentService,
        {
          provide: SerialFacadeService,
          useValue: { exec$, send$, isConnected },
        },
        {
          provide: PiZeroPromptDetectorService,
          useValue: {
            isCommandCompleted: () => true,
          },
        },
      ],
    });

    service = TestBed.inject(FileContentService);
    vi.spyOn(FileUtils, 'buildTempSavePath').mockReturnValue(
      '/home/pi/.main.js.chirimen-saving.test',
    );
  });

  function setupSuccessfulSmallWrite(content: string): void {
    const expected = FileUtils.utf8ByteLength(content);
    const b64 = FileUtils.arrayBufferToBase64(
      new TextEncoder().encode(content).buffer,
    );

    exec$.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.startsWith('cat >')) {
        return of({ stdout: '' });
      }
      if (typeof cmd === 'string' && cmd.startsWith('wc -c')) {
        return of({ stdout: `${expected} /home/pi/.main.js.chirimen-saving.test\n` });
      }
      if (typeof cmd === 'string' && cmd.startsWith('mv --')) {
        return of({ stdout: '' });
      }
      if (typeof cmd === 'string' && cmd.startsWith('base64 --')) {
        return of({
          stdout: `base64 -- /home/pi/main.js\n${b64}\npi@raspberrypi:~$ `,
        });
      }
      if (typeof cmd === 'string' && cmd.startsWith('rm -f')) {
        return of({ stdout: '' });
      }
      return of({ stdout: '' });
    });
  }

  it('writes via temp file, verifies size, then replaces the target', async () => {
    const content = "console.log('ok');\n";
    setupSuccessfulSmallWrite(content);

    await service.writeTextFile('/home/pi/main.js', content);

    const commands = exec$.mock.calls.map((args: unknown[]) => args[0] as string);
    expect(commands[0]).toContain('cat >');
    expect(commands[0]).toContain('.main.js.chirimen-saving.test');
    expect(commands[1]).toContain('wc -c --');
    expect(commands[2]).toMatch(/^mv -- /);
    expect(commands[2]).toContain('.main.js.chirimen-saving.test');
    expect(commands[2]).toContain('main.js');
    expect(commands.some((c) => c.startsWith('rm -f'))).toBe(false);
  });

  it('cleans up the temp file and skips mv when size verification fails', async () => {
    exec$.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.startsWith('cat >')) {
        return of({ stdout: '' });
      }
      if (typeof cmd === 'string' && cmd.startsWith('wc -c')) {
        return of({ stdout: '1 /tmp/x\n' });
      }
      if (typeof cmd === 'string' && cmd.startsWith('rm -f')) {
        return of({ stdout: '' });
      }
      return of({ stdout: '' });
    });

    await expect(
      service.writeTextFile('/home/pi/main.js', 'abc'),
    ).rejects.toThrow(/did not match|Save failed/);

    const commands = exec$.mock.calls.map((args: unknown[]) => args[0] as string);
    expect(commands.some((c) => c.startsWith('mv --'))).toBe(false);
    expect(commands.some((c) => c.startsWith('rm -f'))).toBe(true);
  });

  it('fails fast when serial is disconnected', async () => {
    isConnected.mockReturnValue(false);

    await expect(
      service.writeTextFile('/home/pi/main.js', 'x'),
    ).rejects.toThrow(/connection was lost or cancelled/);

    expect(exec$).not.toHaveBeenCalled();
  });

  it('classifies permission errors from the shell', async () => {
    exec$.mockReturnValue(
      throwError(() => new Error('Permission denied')),
    );

    await expect(
      service.writeTextFile('/home/pi/main.js', 'x'),
    ).rejects.toThrow(/write permission was denied/);

    const commands = exec$.mock.calls.map((args: unknown[]) => args[0] as string);
    expect(commands.some((c) => c.startsWith('rm -f'))).toBe(true);
  });

  it('uses chunked binary write for large payloads', async () => {
    const content = 'a'.repeat(FileUtils.TEXT_CHUNK_THRESHOLD_BYTES + 1);
    const expected = FileUtils.utf8ByteLength(content);

    exec$.mockImplementation((cmd: string) => {
      if (typeof cmd === 'string' && cmd.includes('base64 -d >')) {
        return of({ stdout: '' });
      }
      if (typeof cmd === 'string' && cmd.startsWith('wc -c')) {
        return of({
          stdout: `${expected} /home/pi/.main.js.chirimen-saving.test\n`,
        });
      }
      if (typeof cmd === 'string' && cmd.startsWith('mv --')) {
        return of({ stdout: '' });
      }
      // binary chunk lines and trailing prompt wait
      return of({ stdout: '' });
    });

    await service.writeTextFile('/home/pi/main.js', content);

    const commands = exec$.mock.calls.map((args: unknown[]) => args[0] as string);
    expect(commands.some((c) => c.includes('base64 -d >'))).toBe(true);
    expect(commands.some((c) => c.startsWith('cat >'))).toBe(false);
    expect(commands.some((c) => c.startsWith('mv --'))).toBe(true);
    expect(send$).toHaveBeenCalled();
  });
});
