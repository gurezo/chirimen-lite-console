/**
 * Returns true when `name` is a single path segment suitable for create/rename.
 */
export function isValidFileName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed === '.' || trimmed === '..') {
    return false;
  }
  if (trimmed.includes('/')) {
    return false;
  }
  return true;
}
