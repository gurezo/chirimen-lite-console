export type EditorSaveStatus =
  | 'loading'
  | 'savedToDevice'
  | 'unsavedChanges'
  | 'draftSavedLocally'
  | 'saving'
  | 'saveFailed';

export const EDITOR_SAVE_STATUS_LABEL: Record<EditorSaveStatus, string> = {
  loading: 'Loading',
  savedToDevice: 'Saved to device',
  unsavedChanges: 'Unsaved changes',
  draftSavedLocally: 'Draft saved locally',
  saving: 'Saving',
  saveFailed: 'Save failed',
};

export function isEditorDirtyStatus(
  status: EditorSaveStatus | null | undefined,
): boolean {
  return (
    status === 'unsavedChanges' ||
    status === 'draftSavedLocally' ||
    status === 'saveFailed'
  );
}
