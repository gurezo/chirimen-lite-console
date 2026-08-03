/**
 * File tree panel presentation state for connection / load / empty / error (#812).
 */
export type FileTreeViewState =
  | 'disconnected'
  | 'neverConnected'
  | 'connecting'
  | 'loading'
  | 'empty'
  | 'fetchFailed'
  | 'ready';

export const FILE_TREE_VIEW_MESSAGES: Record<
  Exclude<FileTreeViewState, 'ready' | 'loading'>,
  { title: string; detail?: string }
> = {
  neverConnected: {
    title: 'CHIRIMEN Lite に接続されていません。',
    detail: 'Terminal または接続操作からデバイスへ接続してください。',
  },
  disconnected: {
    title: 'CHIRIMEN Lite との接続が切断されました。',
    detail: '未保存の変更は Editor または Draft に保持されています。',
  },
  connecting: {
    title: 'CHIRIMEN Lite に接続しています…',
  },
  empty: {
    title: 'このフォルダーにはファイルがありません。',
  },
  fetchFailed: {
    title: 'ファイル一覧を取得できませんでした。',
  },
};
