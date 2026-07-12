import '@angular/compiler';
import { Injector } from '@angular/core';
import { FileContentService } from '@libs-wifi';
import {
  PiZeroPromptDetectorService,
  SerialFacadeService,
  SERIAL_TIMEOUT,
} from '@libs-web-serial';
import { FileUtils } from '@libs-wifi';
import { from } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileService } from './file.service';

function expectShellExecOptions(
  options: Record<string, unknown>,
  timeout: number,
): void {
  expect(options.prompt).toBe('');
  expect(options.promptMatch).toBeTypeOf('function');
  expect(options.timeout).toBe(timeout);
  const promptMatch = options.promptMatch as (buf: string) => boolean;
  expect(promptMatch('pi@custom-host:~$ ')).toBe(true);
  expect(promptMatch('pi@raspberrypi:~$ ')).toBe(true);
}

describe('FileService', () => {
  let exec: ReturnType<typeof vi.fn>;
  let readFile: ReturnType<typeof vi.fn>;
  let writeBinaryFile: ReturnType<typeof vi.fn>;
  let svc: FileService;

  beforeEach(() => {
    exec = vi.fn().mockResolvedValue({ stdout: '' });
    readFile = vi.fn();
    writeBinaryFile = vi.fn().mockResolvedValue(undefined);
    const injector = Injector.create({
      providers: [
        FileService,
        PiZeroPromptDetectorService,
        {
          provide: SerialFacadeService,
          useValue: {
            exec$: (...args: unknown[]) => from(exec(...args)),
          },
        },
        {
          provide: FileContentService,
          useValue: { readFile, writeBinaryFile },
        },
      ],
    });
    svc = injector.get(FileService);
  });

  describe('listLines', () => {
    it('returns trimmed non-empty lines from stdout', async () => {
      exec.mockResolvedValue({
        stdout: '  first line  \n\nsecond\n',
      });

      const lines = await svc.listLines('.');
      expect(lines).toEqual(['first line', 'second']);
    });

    it('uses current directory when path is empty', async () => {
      exec.mockResolvedValue({ stdout: 'x\n' });
      await svc.listLines('');
      expect(exec).toHaveBeenCalledWith(
        `ls -al --quoting-style=c -- ${FileUtils.escapePath('.')}`,
        expect.objectContaining({ timeout: SERIAL_TIMEOUT.LONG }),
      );
      expectShellExecOptions(exec.mock.calls[0]?.[1], SERIAL_TIMEOUT.LONG);
    });

    it('passes escaped path to ls', async () => {
      exec.mockResolvedValue({ stdout: '' });
      await svc.listLines('./my dir');
      expect(exec).toHaveBeenCalledWith(
        `ls -al --quoting-style=c -- ${FileUtils.escapePath('./my dir')}`,
        expect.objectContaining({ timeout: SERIAL_TIMEOUT.LONG }),
      );
      expectShellExecOptions(exec.mock.calls[0]?.[1], SERIAL_TIMEOUT.LONG);
    });

    it('uses flexible shell prompt match for non-default hostnames', async () => {
      exec.mockResolvedValue({ stdout: 'file.txt\n' });
      await svc.listLines('.');
      const options = exec.mock.calls[0]?.[1] as {
        promptMatch?: (buf: string) => boolean;
      };
      expect(options.promptMatch?.('pi@pizero-w:~$ ')).toBe(true);
      expect(options.promptMatch?.('pi@raspberrypi:~$ ')).toBe(true);
    });
  });

  describe('listTree', () => {
    it('parses ls lines into tree nodes', async () => {
      exec.mockResolvedValue({
        stdout: [
          'drwxr-xr-x 2 pi pi 4096 Mar 20 10:00 "docs"',
          '-rw-r--r-- 1 pi pi 10 Mar 20 10:00 "main.ts"',
        ].join('\n'),
      });

      const nodes = await svc.listTree('.');
      expect(nodes.map((n) => n.name)).toEqual(['docs', 'main.ts']);
      expect(nodes[0].isDirectory).toBe(true);
      expect(nodes[1].isDirectory).toBe(false);
    });
  });

  describe('mkdir', () => {
    it('runs mkdir -p with escaped path', async () => {
      await svc.mkdir('/tmp/a');
      expect(exec).toHaveBeenCalledWith(
        `mkdir -p -- ${FileUtils.escapePath('/tmp/a')}`,
        expect.objectContaining({ timeout: SERIAL_TIMEOUT.DEFAULT }),
      );
      expectShellExecOptions(exec.mock.calls[0]?.[1], SERIAL_TIMEOUT.DEFAULT);
    });
  });

  describe('touch', () => {
    it('runs touch with escaped path', async () => {
      await svc.touch('./file.txt');
      expect(exec).toHaveBeenCalledWith(
        `touch -- ${FileUtils.escapePath('./file.txt')}`,
        expect.objectContaining({ timeout: SERIAL_TIMEOUT.DEFAULT }),
      );
      expectShellExecOptions(exec.mock.calls[0]?.[1], SERIAL_TIMEOUT.DEFAULT);
    });
  });

  describe('remove', () => {
    it('runs rm with escaped path', async () => {
      await svc.remove('./old.txt');
      expect(exec).toHaveBeenCalledWith(
        `rm -- ${FileUtils.escapePath('./old.txt')}`,
        expect.objectContaining({ timeout: SERIAL_TIMEOUT.DEFAULT }),
      );
      expectShellExecOptions(exec.mock.calls[0]?.[1], SERIAL_TIMEOUT.DEFAULT);
    });
  });

  describe('read', () => {
    it('returns string content for text files', async () => {
      readFile.mockResolvedValue({
        isText: true,
        content: 'hello',
        size: 5,
      });

      await expect(svc.read('./readme.txt')).resolves.toBe('hello');
      expect(readFile).toHaveBeenCalledWith('./readme.txt');
    });

    it('throws when file is not text', async () => {
      readFile.mockResolvedValue({
        isText: false,
        content: new ArrayBuffer(4),
        size: 4,
      });

      await expect(svc.read('./bin.dat')).rejects.toThrow(
        'Target file is not a text file',
      );
    });

    it('throws when content is not a string', async () => {
      readFile.mockResolvedValue({
        isText: true,
        content: new ArrayBuffer(2),
        size: 2,
      });

      await expect(svc.read('./weird')).rejects.toThrow(
        'Target file is not a text file',
      );
    });
  });

  describe('move', () => {
    it('runs mv with escaped paths', async () => {
      await svc.move('./a', './b');
      expect(exec).toHaveBeenCalledWith(
        `mv -- ${FileUtils.escapePath('./a')} ${FileUtils.escapePath('./b')}`,
        expect.objectContaining({ timeout: SERIAL_TIMEOUT.DEFAULT }),
      );
      expectShellExecOptions(exec.mock.calls[0]?.[1], SERIAL_TIMEOUT.DEFAULT);
    });
  });

  describe('writeBinary', () => {
    it('delegates to FileContentService.writeBinaryFile', async () => {
      const buffer = new ArrayBuffer(8);
      await svc.writeBinary('./out.bin', buffer);
      expect(writeBinaryFile).toHaveBeenCalledWith('./out.bin', buffer);
    });
  });
});
