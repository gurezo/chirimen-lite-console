/**
 * ファイル保存失敗の原因を判別しやすいメッセージへ正規化する。
 */
export function classifyFileWriteError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes('not connected') ||
    lower.includes('all commands cancelled') ||
    lower.includes('connection lost')
  ) {
    return new Error(
      'Save failed: serial connection was lost or cancelled. Reconnect and try again.',
    );
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return new Error(
      'Save failed: the write timed out. Check the connection and try again.',
    );
  }

  if (
    lower.includes('permission denied') ||
    lower.includes('operation not permitted')
  ) {
    return new Error(
      'Save failed: write permission was denied for the target file.',
    );
  }

  if (
    lower.includes('no space left') ||
    lower.includes('disk quota exceeded')
  ) {
    return new Error(
      'Save failed: the device has insufficient disk space.',
    );
  }

  if (
    lower.includes('no such file or directory') ||
    lower.includes('not a directory')
  ) {
    return new Error(
      'Save failed: the target path does not exist or is not writable.',
    );
  }

  if (
    lower.includes('size mismatch') ||
    lower.includes('content mismatch') ||
    lower.includes('verify')
  ) {
    return new Error(
      'Save failed: written content did not match the editor content.',
    );
  }

  if (raw.startsWith('Save failed:')) {
    return error instanceof Error ? error : new Error(raw);
  }

  return new Error(`Save failed: ${raw}`);
}
