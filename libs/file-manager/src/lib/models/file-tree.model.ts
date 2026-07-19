export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  /**
   * Synthetic target for the current-directory context menu.
   * Rename/delete are not offered for virtual targets.
   */
  virtual?: boolean;
}
