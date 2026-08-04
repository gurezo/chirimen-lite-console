import { InjectionToken } from '@angular/core';

/**
 * Minimal draft lifecycle API used by shell / file-tree without importing
 * the lazy-loaded editor library (issue #810).
 * Implementation lives in shared (`EditorDraftService`) so app config can
 * wire the token without a static import of `@libs-editor`.
 */
export interface EditorDraftLifecycle {
  has(path: string): boolean;
  rename(from: string, to: string): void;
  clear(path: string): void;
}

export const EDITOR_DRAFT_LIFECYCLE = new InjectionToken<EditorDraftLifecycle>(
  'EDITOR_DRAFT_LIFECYCLE',
);
