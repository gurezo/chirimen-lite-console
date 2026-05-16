# Conventional Commits Scopes (chirimen-lite-console)

scope の単一の真実は [commitlint.config.js](../../../commitlint.config.js) の `scope-enum` です。詳細用途は [CONTRIBUTING.md](../../../CONTRIBUTING.md) のスコープ表を参照してください。本ファイルは AI が scope を選択する際のクイックリファレンスです。

## scope 一覧

| Scope                    | 用途                                                         |
| ------------------------ | ------------------------------------------------------------ |
| `console`                | メインアプリ (`apps/console`)                                |
| `console-shell`          | コンソールシェル lib                                         |
| `connect`                | 接続 lib                                                     |
| `page-not-found`         | 404 ページ lib                                               |
| `web-serial`             | Web Serial lib（全体）                                       |
| `web-serial-util`        | Web Serial lib の util                                       |
| `web-serial-data-access` | Web Serial lib の data-access                                |
| `example`                | サンプル lib                                                 |
| `wifi`                   | Wi-Fi lib                                                    |
| `dialogs`                | ダイアログ lib                                               |
| `unsupported-browser`    | 非対応ブラウザ lib                                           |
| `editor`                 | エディタ lib                                                 |
| `terminal`               | ターミナル lib                                               |
| `pin-assign-panel`       | ピン割り当てパネル lib                                       |
| `shared-ui`              | 共有 UI lib                                                  |
| `shared-guards`          | 共有ガード lib                                               |
| `shared-types`           | 共有型定義 lib                                               |
| `shared-util`            | 共有ユーティリティ lib                                       |
| `i2cdetect`              | I2C 検出 lib（feature 全体）                                 |
| `i2cdetect-ui`           | I2C 検出 lib の UI                                           |
| `i2cdetect-data-access`  | I2C 検出 lib の data-access                                  |
| `i2cdetect-util`         | I2C 検出 lib の util                                         |
| `workspace`              | ルート・共通設定（package.json, nx.json, tsconfig, CI など） |
| `setup`                  | chirimen セットアップ lib                                    |
| `file-manager`           | ファイルマネージャ lib                                       |
| `remote`                 | リモート lib                                                 |

## 選び方

1. 影響が 1 つの lib / app に閉じる → その lib / app 名を選ぶ
2. ルート設定 / CI / husky / commitlint / docs 横断 → `workspace`
3. リポジトリ全体の運用ドキュメント → `workspace`
4. 複数 lib にまたがる変更は、可能なら commit / PR を分割する

## 採用しない scope（Issue #692 由来）

下記は本ワークスペースに対応する Nx プロジェクトが存在しない、または既存 scope と重複するため採用しません。

- `web-serial-rxjs` — 外部パッケージ。本リポジトリの変更 scope ではない
- `signal-store`, `ngrx`, `shared-store` — 専用 lib として分離されていない
- `connection`, `connection-guard` — 機能は `connect` / `shared-guards` でカバー
- `auth`, `timezone`, `device-detection` — 該当 lib なし
- `i2c-detect` — `i2cdetect` を使用する
- `menu`, `layout`, `theme`, `toolbar`, `router`, `settings` — 該当 lib なし、`console` / `console-shell` で吸収
- `release`, `ci`, `docs` — `workspace` で吸収

## scope を追加したい場合

1. Nx generator で新 lib を作成（`nx-generate` skill を参照）
2. [commitlint.config.js](../../../commitlint.config.js) の `scope-enum` に追加
3. [CONTRIBUTING.md](../../../CONTRIBUTING.md) のスコープ表を更新
4. このファイルと [.cursor/rules/commit/20-chirimen-lite-console-scope.mdc](../../../.cursor/rules/commit/20-chirimen-lite-console-scope.mdc) を更新
