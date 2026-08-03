import { InjectionToken } from '@angular/core';

/**
 * Minimal draft lifecycle API used by shell / file-tree without importing
 * the lazy-loaded editor library (issue #810).
 */
export interface EditorDraftLifecycle {
  has(path: string): boolean;
  rename(from: string, to: string): void;
  clear(path: string): void;
}

export const EDITOR_DRAFT_LIFECYCLE = new InjectionToken<EditorDraftLifecycle>(
  'EDITOR_DRAFT_LIFECYCLE',
);
