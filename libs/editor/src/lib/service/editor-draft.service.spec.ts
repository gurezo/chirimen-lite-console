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

  it('stores and restores an unsaved draft', () => {
    const service = createService();

    service.save('/home/pi/example.js', 'console.log("draft");');

    expect(service.read()).toEqual({
      path: '/home/pi/example.js',
      content: 'console.log("draft");',
      dirty: true,
    });
  });

  it('clears a stored draft', () => {
    const service = createService();
    service.save('/home/pi/example.js', 'draft');

    service.clear();

    expect(service.read()).toBeNull();
  });

  it('ignores and removes malformed storage values', () => {
    const storage = createStorage();
    storage.setItem(
      'chirimen-lite-console.editor-draft',
      JSON.stringify({ path: '', content: 1 }),
    );
    const service = createService(storage);

    expect(service.read()).toBeNull();
    expect(storage.length).toBe(0);
  });
});
