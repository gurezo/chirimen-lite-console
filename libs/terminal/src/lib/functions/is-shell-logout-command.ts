/**
 * 対話シェルの logout / exit（セッション終了）コマンドかどうか。
 */
export function isShellLogoutCommand(command: string): boolean {
  const normalized = command.trim().toLowerCase();
  return normalized === 'logout' || normalized === 'exit';
}
