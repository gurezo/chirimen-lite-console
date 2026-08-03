import { Injector } from '@angular/core';
import { describe, expect, it } from 'vitest';
import {
  EDITOR_DRAFT_STORAGE,
  EditorDraftService,
} from './editor-draft.service';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe('EditorDraftService', () => {
  function createService(storage = createStorage()): EditorDraftService {
    return Injector.create({
      providers: [
        EditorDraftService,
        { provide: EDITOR_DRAFT_STORAGE, useValue: storage },
      ],
    }).get(EditorDraftService);
  }

  it('stores and restores a draft for a path', () => {
    const service = createService();

    service.save('/home/pi/example.js', 'console.log("draft");');

    expect(service.read('/home/pi/example.js')).toEqual({
      path: '/home/pi/example.js',
      content: 'console.log("draft");',
      updatedAt: expect.any(Number),
    });
    expect(service.has('/home/pi/example.js')).toBe(true);
  });

  it('keeps drafts for different paths separate', () => {
    const service = createService();

    service.save('/home/pi/a/main.js', 'a');
    service.save('/home/pi/b/main.js', 'b');

    expect(service.read('/home/pi/a/main.js')?.content).toBe('a');
    expect(service.read('/home/pi/b/main.js')?.content).toBe('b');
    expect(service.list()).toHaveLength(2);
  });

  it('clears a single path without removing others', () => {
    const service = createService();
    service.save('/home/pi/a.js', 'a');
    service.save('/home/pi/b.js', 'b');

    service.clear('/home/pi/a.js');

    expect(service.read('/home/pi/a.js')).toBeNull();
    expect(service.read('/home/pi/b.js')?.content).toBe('b');
  });

  it('clears all drafts', () => {
    const service = createService();
    service.save('/home/pi/a.js', 'a');
    service.save('/home/pi/b.js', 'b');

    service.clearAll();

    expect(service.list()).toEqual([]);
  });

  it('ignores and removes malformed storage values', () => {
    const storage = createStorage();
    storage.setItem(
      'chirimen-lite-console.editor-drafts',
      JSON.stringify({ '/bad': { content: 1 } }),
    );
    const service = createService(storage);

    expect(service.read('/bad')).toBeNull();
    expect(storage.getItem('chirimen-lite-console.editor-drafts')).toBeNull();
  });

  it('migrates a legacy single-draft entry', () => {
    const storage = createStorage();
    storage.setItem(
      'chirimen-lite-console.editor-draft',
      JSON.stringify({
        path: '/home/pi/legacy.js',
        content: 'legacy draft',
        dirty: true,
      }),
    );
    const service = createService(storage);

    expect(service.read('/home/pi/legacy.js')?.content).toBe('legacy draft');
    expect(storage.getItem('chirimen-lite-console.editor-draft')).toBeNull();
    expect(storage.getItem('chirimen-lite-console.editor-drafts')).not.toBeNull();
  });
});
