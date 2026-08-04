# Editor

CHIRIMEN Lite 上のテキストファイルをブラウザから選択・編集・保存するための Editor 機能（[`/editor`](http://localhost:4200/editor)）です。

親 Epic: [#804](https://github.com/gurezo/chirimen-lite-console/issues/804)  
利用ドキュメント整備: [#816](https://github.com/gurezo/chirimen-lite-console/issues/816)

切断時の Draft / デバイス保存のアーキテクチャ上の位置づけは [docs/serial-architecture.md](../../docs/serial-architecture.md) も参照してください。

## 画面の目的

Editor では次の一連の操作を安全に完了できます。

1. CHIRIMEN Lite に Web Serial で接続する
2. 左のファイルツリーからテキストファイルを選ぶ
3. Monaco Editor に内容を読み込む
4. 編集する（ローカル Draft が自動保存される）
5. 未保存状態を確認する
6. CHIRIMEN Lite 上の実ファイルへ保存する
7. 必要に応じて Format・新規作成・名称変更・削除を行う

## CHIRIMEN Lite への接続

1. 対応ブラウザ（Chrome / Edge など Web Serial 対応）でアプリを開く
2. Connect 画面から Web Serial でデバイスを選択し接続する
3. シェル準備完了後、ナビから **Editor**（`/editor`）へ移動する

Editor ルート自体には接続ガードはありません。未接続でも画面は開けますが、デバイスからの読込・Save・Format・New File には接続が必要です。未接続時はバナーで案内されます。

## ファイルを開く

1. 左サイドバーのファイルツリーでディレクトリを展開する
2. テキストファイルをクリックする
3. 内容が中央の Monaco Editor に読み込まれる
4. ツールバー付近にファイル名・パス・言語モード・保存状態が表示される

同じパスにローカル Draft がある場合は「Local draft found」ダイアログが表示されます（後述）。

バイナリなど非テキスト扱いのファイルは開けません（`Target file is not a text file`）。

## ファイルを保存する（Save）

Toolbar の **Save**、またはショートカットでデバイス上の実ファイルへ書き込みます。

保存パイプライン（[#807](https://github.com/gurezo/chirimen-lite-console/issues/807)）:

1. 一時ファイルへ書き込み
2. サイズ検証
3. `mv` で対象パスへ置換
4. 保存後検証

置換が成功するまで元ファイルは置き換わりません。失敗時は Editor 上の内容と Draft を維持し、状態は **Save failed** になります。

## Save と Draft の違い

| 種類 | タイミング | 保存先 | 意味 |
| --- | --- | --- | --- |
| **Draft** | 内容変更のたびに自動 | 同一ブラウザタブの `sessionStorage`（キー `chirimen-lite-console.editor-drafts`、パス単位） | ローカルの下書き。デバイスには反映されない |
| **Save** | 明示操作（Toolbar / `Ctrl`・`Cmd`+`S`） | CHIRIMEN Lite のファイルシステム | 実ファイルへの確定保存 |

独立した「Draft Save」ボタンはありません。Draft は編集中に自動で書き込まれ、状態ラベルは **Draft saved locally** になります。デバイスへ保存が成功すると、そのパスの Draft はクリアされ、状態は **Saved to device** になります。

### 保存状態ラベル

| ラベル | 意味 |
| --- | --- |
| Loading | デバイスから読込中 |
| Saved to device | デバイスへ保存済み（または読込直後で未編集） |
| Unsaved changes | 変更直後（直後に Draft 保存へ遷移しうる） |
| Draft saved locally | ローカル Draft あり。デバイス未反映 |
| Saving | デバイスへ保存中 |
| Save failed | デバイス保存失敗（内容と Draft は保持） |

## Format の利用方法

Toolbar の **Format**、またはショートカットで Monaco の `editor.action.formatDocument` を実行します。

- 接続中かつファイルが開かれている必要があります
- 対象言語にフォーマッタが無い場合は「この言語向けのフォーマッターはありません。」と警告し、内容は変わりません
- Format 後の変更は通常どおり Draft として扱われます。デバイスへ反映するには Save が必要です

## キーボードショートカット

| 操作 | Windows / Linux | macOS |
| --- | --- | --- |
| 保存（Save） | `Ctrl + S` | `Cmd + S` |
| フォーマット | `Shift + Alt + F` | `Shift + Option + F` |
| 検索 | `Ctrl + F` | `Cmd + F` |
| 置換 | `Ctrl + H` | Monaco の既定（環境により `Cmd + Option + F` など） |

Save / Format は Editor ページが処理し、Monaco 側の同キーは二重発火しないよう抑制しています。検索・置換は Monaco Editor の既定動作です。

## 新規ファイル作成・名称変更・削除

### 新規ファイル（Toolbar **New File**）

- 接続中のみ利用できます
- 現在のファイルマネージャパス配下に名前を指定して作成（`touch`）し、作成後にそのファイルを開きます
- 同名が既にある場合はエラーになります
- ファイル名は単一セグメント（`/` を含まない）。`.` / `..` は不可

### ファイルツリーのコンテキストメニュー

左ナビのファイルツリーから次が可能です。

- 新規ファイル / 新規ディレクトリ
- 名称変更（`move`）
- 削除（ディレクトリは再帰削除）

名称変更時は Draft もパスに追従します。削除時に未保存 Draft がある場合は確認ダイアログが表示され、削除するとそのパスの Draft もクリアされます。

## 対応するファイル形式

テキストとして開ける拡張子（抜粋。実装は `FileUtils.TEXT_FILE_EXTENSIONS`）:

`.txt` `.sh` `.csv` `.tsv` `.js` `.conf` `.mjs` `.md` `.yml` `.xml` `.html` `.htm` `.json` `.py` `.php` `.log` `.ts` `.tsx` `.jsx` `.css` `.scss` `.sass` `.less`

拡張子なしのファイル、およびドットファイル（例: `.env`）もテキストとして扱います。

### Monaco 言語モード（シンタックスハイライト）

| 拡張子 | モード |
| --- | --- |
| `.js` `.mjs` `.cjs` | JavaScript |
| `.json` | JSON |
| `.html` `.htm` | HTML |
| `.css` | CSS |
| `.md` | Markdown |
| `.sh` | Shell |
| `.txt` およびその他 | Plain Text |

`.py` / `.ts` / `.yml` など開けるがハイライトが Plain Text の拡張子があります。`.cjs` は言語マップにありますが、テキスト拡張子リストには含まれないため、通常は非テキスト扱いで開けません。

## 文字コードと改行コード

- **文字コード**: UTF-8 のみ。不正な UTF-8 は開けません
- **BOM**: 読込時に検出し、保存時に元の有無を復元します
- **改行**: LF / CRLF を検出し、編集中は LF に正規化。保存時に元の改行スタイルと末尾改行の有無を復元します
- **新規ファイル**: UTF-8・BOM なし・LF・末尾改行あり

## ファイルサイズ上限

| 閾値 | 値 | 挙動 |
| --- | --- | --- |
| 警告 | 256 KiB（`EDITOR_FILE_WARN_BYTES`） | 開く前に確認ダイアログ。転送中は進捗 UI |
| 上限 | 1 MiB（`EDITOR_FILE_MAX_BYTES`） | 開くことを拒否 |

サイズはデバイス上のバイト数（`wc -c`）を基準にします。大きなファイルの Save でも進捗ダイアログが表示され、キャンセルできます（Draft は保持されます）。

## 保存途中に切断した場合の挙動

- 未接続のときは Save は実行されません
- 保存中に切断・失敗した場合、状態は **Save failed** になり、Editor 上の内容と Draft は保持されます
- バナー例: 「デバイスへの保存に失敗しました。内容は Editor / Draft に保持されています。」
- 失敗要因（接続切断、タイムアウト、権限、容量不足、パス不存在、検証不一致など）は可能な範囲で判別しやすいメッセージに正規化されます
- 進捗ダイアログをユーザーがキャンセルした場合も Draft は保持されます

切断やログアウト後も同一タブの Draft は `sessionStorage` に残ります。詳細は [docs/serial-architecture.md](../../docs/serial-architecture.md) を参照してください。

## Draft の復元と破棄

### ファイルを開いたとき（Local draft found）

| 操作 | 結果 |
| --- | --- |
| **Restore draft** | Draft 内容を Editor に載せる（状態: Draft saved locally） |
| **Discard draft** / **Reload from device** | Draft を捨て、デバイスから再読込 |
| ダイアログを閉じる | Discard / Reload と同様 |

### Toolbar **Discard**

確認後、ローカル変更を破棄し、最後に読み込んだデバイス内容（または再読込）へ戻します。

### 画面遷移・ファイル切替

- 未保存のまま別ファイルを選ぶと確認ダイアログが出ます（Discard すると現在パスの Draft もクリア）
- Editor から離れるときも確認します。メッセージ上、ローカル Draft は同一タブに残ることがあります
- ブラウザのタブを閉じる／リロードするときは `beforeunload` で警告します（`sessionStorage` の Draft はタブを閉じると消えます）

## 読取専用ファイルの扱い

ファイルのパーミッションを読込時に常時反映するわけではありません。Save が権限エラー（permission denied）になった場合に Editor が **Read-only** になり、Monaco が編集不可になります。再読込や保存成功などで解除されます。

## 既知の制約

- 複数ユーザーによる同時編集や、競合解決はありません
- Git クライアント機能はありません
- Draft は **同一タブの `sessionStorage`** のみ（別タブ・別ブラウザ・タブ閉鎖後は復元できません）
- 未接続でも編集・Draft は可能ですが、デバイス I/O はできません
- 一部のテキスト拡張子は開けるがシンタックスハイライトは Plain Text です
- Format は Monaco が提供する言語向けフォーマッタに依存します
- ワークスペース全体の E2E 基盤は [#815](https://github.com/gurezo/chirimen-lite-console/issues/815) で扱います（本ドキュメントの対象外）

## トラブルシューティング

| 症状 | 確認・対処 |
| --- | --- |
| 「CHIRIMEN Lite に接続されていません」 | Connect から再接続する。Draft は同一タブに残っている場合があります |
| ファイルを開けない（大きすぎる） | 1 MiB 以下にするか、デバイス側で分割する |
| UTF-8 ではないため開けない | デバイス上で UTF-8 に変換してから開く |
| 保存に失敗する | 接続・書き込み権限・ディスク容量・パスの存在を確認し、内容は Draft に残っているので再 Save する |
| フォーマットできない | その言語に Monaco フォーマッタが無い。手編集後に Save する |
| Read-only になる | 書き込み権限をデバイス側で直し、ファイルを開き直す |
| Draft が消えた | タブを閉じた／別タブを使った可能性。`sessionStorage` はタブ単位です |
| ファイルツリーが空 / No files | 接続とシェル準備完了を確認し、左ナビを更新する |

## 関連 Issue

- Epic: [#804](https://github.com/gurezo/chirimen-lite-console/issues/804)
- 本ドキュメント: [#816](https://github.com/gurezo/chirimen-lite-console/issues/816)
- 読込 [#805] / Draft [#806] / 安全保存 [#807] / Toolbar [#808] / 表示 [#809] / CRUD [#810] / レスポンシブ [#811] / 状態表示 [#812] / 大容量・UTF-8・改行 [#813] / a11y [#814]
