import { TestBed } from '@angular/core/testing';
import { FileContentService, SerialFacadeService } from '@libs-web-serial';
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
          useValue: { writeTextFile, readFile: vi.fn() },
        },
        {
          provide: SerialFacadeService,
          useValue: { isConnected },
        },
      ],
    });

    service = TestBed.inject(EditorService);
  });

  it('delegates to FileContentService when connected', async () => {
    await service.saveTextFile('/home/pi/a.js', 'x = 1');
    expect(writeTextFile).toHaveBeenCalledWith('/home/pi/a.js', 'x = 1');
  });

  it('fails without writing when disconnected', async () => {
    isConnected.mockReturnValue(false);

    await expect(
      service.saveTextFile('/home/pi/a.js', 'x = 1'),
    ).rejects.toThrow(/connection was lost or cancelled/);

    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('classifies underlying write failures', async () => {
    writeTextFile.mockRejectedValueOnce(new Error('Permission denied'));

    await expect(
      service.saveTextFile('/home/pi/a.js', 'x = 1'),
    ).rejects.toThrow(/write permission was denied/);
  });
});
