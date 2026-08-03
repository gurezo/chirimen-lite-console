export interface FileNameDialogData {
  title?: string;
  initialValue?: string;
  confirmLabel?: string;
  label?: string;
  /** Optional hint shown under the title (e.g. current path before rename). */
  description?: string;
}
