import { TestBed } from '@angular/core/testing';
import {
  DEFAULT_NEW_TEXT_FILE_META,
  FileContentService,
  SerialFacadeService,
} from '@libs-web-serial';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorService } from './editor.service';

describe('EditorService.saveTextFile', () => {
  let service: EditorService;
  let writeTextFile: ReturnType<typeof vi.fn>;
  let isConnected: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeTextFile = vi.fn().mockResolvedValue(undefined);
    isConnected = vi.fn().mockReturnValue(true);

    TestBed.configureTestingModule({
      providers: [
        EditorService,
        {
          provide: FileContentService,
          useValue: { writeTextFile, readFile: vi.fn(), getByteSize: vi.fn() },
        },
        {
          provide: SerialFacadeService,
          useValue: { isConnected, cancelAllCommands: vi.fn() },
        },
      ],
    });

    service = TestBed.inject(EditorService);
  });

  it('serializes meta then delegates to FileContentService when connected', async () => {
    await service.saveTextFile('/home/pi/a.js', 'x = 1', {
      ...DEFAULT_NEW_TEXT_FILE_META,
      trailingNewline: true,
    });
    expect(writeTextFile).toHaveBeenCalledWith('/home/pi/a.js', 'x = 1\n', undefined);
  });

  it('fails without writing when disconnected', async () => {
    isConnected.mockReturnValue(false);

    await expect(
      service.saveTextFile('/home/pi/a.js', 'x', DEFAULT_NEW_TEXT_FILE_META),
    ).rejects.toThrow(/connection was lost or cancelled/);

    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('classifies underlying write failures', async () => {
    writeTextFile.mockRejectedValueOnce(new Error('Permission denied'));

    await expect(
      service.saveTextFile('/home/pi/a.js', 'x', DEFAULT_NEW_TEXT_FILE_META),
    ).rejects.toThrow(/write permission was denied/);
  });
});

describe('EditorService.loadTextFile', () => {
  let service: EditorService;
  let readFile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    readFile = vi.fn().mockResolvedValue({
      content: 'hello',
      isText: true,
      size: 5,
      encoding: 'utf-8',
      meta: DEFAULT_NEW_TEXT_FILE_META,
    });

    TestBed.configureTestingModule({
      providers: [
        EditorService,
        {
          provide: FileContentService,
          useValue: {
            writeTextFile: vi.fn(),
            readFile,
            getByteSize: vi.fn().mockResolvedValue(5),
          },
        },
        {
          provide: SerialFacadeService,
          useValue: {
            isConnected: vi.fn().mockReturnValue(true),
            cancelAllCommands: vi.fn(),
          },
        },
      ],
    });

    service = TestBed.inject(EditorService);
  });

  it('returns content and meta for text files', async () => {
    await expect(service.loadTextFile('/home/pi/a.js')).resolves.toEqual({
      content: 'hello',
      meta: DEFAULT_NEW_TEXT_FILE_META,
      size: 5,
    });
  });
});

describe('EditorService.formatDocument', () => {
  let service: EditorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        EditorService,
        {
          provide: FileContentService,
          useValue: { writeTextFile: vi.fn(), readFile: vi.fn(), getByteSize: vi.fn() },
        },
        {
          provide: SerialFacadeService,
          useValue: {
            isConnected: vi.fn().mockReturnValue(true),
            cancelAllCommands: vi.fn(),
          },
        },
      ],
    });

    service = TestBed.inject(EditorService);
  });

  it('returns false when the editor is not initialized', async () => {
    await expect(service.formatDocument()).resolves.toBe(false);
  });

  it('returns false when format action is unsupported', async () => {
    const run = vi.fn();
    service.initializeEditor({
      onDidChangeModelContent: vi.fn(),
      getAction: vi.fn().mockReturnValue({
        isSupported: () => false,
        run,
      }),
      getValue: vi.fn().mockReturnValue(''),
      getModel: vi.fn().mockReturnValue(null),
    } as never);

    await expect(service.formatDocument()).resolves.toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('runs the format document action when supported', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    service.initializeEditor({
      onDidChangeModelContent: vi.fn(),
      getAction: vi.fn().mockReturnValue({
        isSupported: () => true,
        run,
      }),
      getValue: vi.fn().mockReturnValue('formatted'),
      getModel: vi.fn().mockReturnValue(null),
    } as never);

    await expect(service.formatDocument()).resolves.toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(service.getValue()).toBe('formatted');
  });
});
