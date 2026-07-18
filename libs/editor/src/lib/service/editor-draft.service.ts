import { Injectable, InjectionToken, inject } from '@angular/core';

export interface EditorDraft {
  path: string;
  content: string;
  dirty: true;
}

const EDITOR_DRAFT_STORAGE_KEY = 'chirimen-lite-console.editor-draft';

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

  read(): EditorDraft | null {
    try {
      const serialized = this.storage.getItem(EDITOR_DRAFT_STORAGE_KEY);
      if (!serialized) {
        return null;
      }
      const value: unknown = JSON.parse(serialized);
      if (!this.isEditorDraft(value)) {
        this.clear();
        return null;
      }
      return value;
    } catch {
      return null;
    }
  }

  save(path: string, content: string): void {
    const draft: EditorDraft = { path, content, dirty: true };
    try {
      this.storage.setItem(EDITOR_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Storage unavailable or full: editing must remain usable in memory.
    }
  }

  clear(): void {
    try {
      this.storage.removeItem(EDITOR_DRAFT_STORAGE_KEY);
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }
  }

  private isEditorDraft(value: unknown): value is EditorDraft {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const candidate = value as Partial<EditorDraft>;
    return (
      typeof candidate.path === 'string' &&
      candidate.path.length > 0 &&
      typeof candidate.content === 'string' &&
      candidate.dirty === true
    );
  }
}
