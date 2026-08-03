import { Injectable, InjectionToken, inject } from '@angular/core';

export interface EditorDraftEntry {
  content: string;
  updatedAt: number;
}

export type EditorDraftMap = Record<string, EditorDraftEntry>;

export interface EditorDraft {
  path: string;
  content: string;
  updatedAt: number;
}

const EDITOR_DRAFT_STORAGE_KEY = 'chirimen-lite-console.editor-drafts';
const LEGACY_EDITOR_DRAFT_STORAGE_KEY = 'chirimen-lite-console.editor-draft';

export const EDITOR_DRAFT_STORAGE = new InjectionToken<Storage>(
  'EDITOR_DRAFT_STORAGE',
  {
    providedIn: 'root',
    factory: () => globalThis.sessionStorage,
  },
);

@Injectable({
  providedIn: 'root',
})
export class EditorDraftService {
  private readonly storage = inject(EDITOR_DRAFT_STORAGE);

  read(path: string): EditorDraft | null {
    const entry = this.readMap()[path];
    if (!entry) {
      return null;
    }
    return { path, content: entry.content, updatedAt: entry.updatedAt };
  }

  has(path: string): boolean {
    return this.read(path) !== null;
  }

  list(): EditorDraft[] {
    return Object.entries(this.readMap()).map(([path, entry]) => ({
      path,
      content: entry.content,
      updatedAt: entry.updatedAt,
    }));
  }

  save(path: string, content: string): void {
    if (!path) {
      return;
    }
    const map = this.readMap();
    map[path] = { content, updatedAt: Date.now() };
    this.writeMap(map);
  }

  clear(path: string): void {
    if (!path) {
      return;
    }
    const map = this.readMap();
    if (!(path in map)) {
      return;
    }
    delete map[path];
    this.writeMap(map);
  }

  /**
   * Moves a draft from one path key to another.
   * No-op when `from` has no draft or paths are equal.
   * Does not overwrite an existing draft at `to`.
   */
  rename(from: string, to: string): void {
    if (!from || !to || from === to) {
      return;
    }
    const map = this.readMap();
    const entry = map[from];
    if (!entry) {
      return;
    }
    if (to in map) {
      return;
    }
    map[to] = entry;
    delete map[from];
    this.writeMap(map);
  }

  clearAll(): void {
    try {
      this.storage.removeItem(EDITOR_DRAFT_STORAGE_KEY);
      this.storage.removeItem(LEGACY_EDITOR_DRAFT_STORAGE_KEY);
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }
  }

  private readMap(): EditorDraftMap {
    try {
      const serialized = this.storage.getItem(EDITOR_DRAFT_STORAGE_KEY);
      if (serialized) {
        const value: unknown = JSON.parse(serialized);
        if (!this.isEditorDraftMap(value)) {
          this.clearAll();
          return {};
        }
        return { ...value };
      }

      return this.migrateLegacyDraft();
    } catch {
      return {};
    }
  }

  private writeMap(map: EditorDraftMap): void {
    try {
      if (Object.keys(map).length === 0) {
        this.storage.removeItem(EDITOR_DRAFT_STORAGE_KEY);
        this.storage.removeItem(LEGACY_EDITOR_DRAFT_STORAGE_KEY);
        return;
      }
      this.storage.setItem(EDITOR_DRAFT_STORAGE_KEY, JSON.stringify(map));
      this.storage.removeItem(LEGACY_EDITOR_DRAFT_STORAGE_KEY);
    } catch {
      // Storage unavailable or full: editing must remain usable in memory.
    }
  }

  private migrateLegacyDraft(): EditorDraftMap {
    try {
      const serialized = this.storage.getItem(LEGACY_EDITOR_DRAFT_STORAGE_KEY);
      if (!serialized) {
        return {};
      }
      const value: unknown = JSON.parse(serialized);
      if (!this.isLegacyEditorDraft(value)) {
        this.storage.removeItem(LEGACY_EDITOR_DRAFT_STORAGE_KEY);
        return {};
      }
      const map: EditorDraftMap = {
        [value.path]: {
          content: value.content,
          updatedAt: Date.now(),
        },
      };
      this.writeMap(map);
      return map;
    } catch {
      return {};
    }
  }

  private isEditorDraftMap(value: unknown): value is EditorDraftMap {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    return Object.entries(value).every(([path, entry]) => {
      if (typeof path !== 'string' || path.length === 0) {
        return false;
      }
      if (typeof entry !== 'object' || entry === null) {
        return false;
      }
      const candidate = entry as Partial<EditorDraftEntry>;
      return (
        typeof candidate.content === 'string' &&
        typeof candidate.updatedAt === 'number'
      );
    });
  }

  private isLegacyEditorDraft(
    value: unknown,
  ): value is { path: string; content: string; dirty: true } {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const candidate = value as Partial<{
      path: string;
      content: string;
      dirty: true;
    }>;
    return (
      typeof candidate.path === 'string' &&
      candidate.path.length > 0 &&
      typeof candidate.content === 'string' &&
      candidate.dirty === true
    );
  }
}
