# Conventional Commits Scopes (chirimen-lite-console)

scope の単一の真実は [commitlint.config.js](../../../commitlint.config.js) の `scope-enum` です。詳細用途は [CONTRIBUTING.md](../../../CONTRIBUTING.md) のスコープ表を参照してください。本ファイルは AI が scope を選択する際のクイックリファレンスです。

## scope 一覧

| Scope                 | 用途                                                         |
| --------------------- | ------------------------------------------------------------ |
| `console`             | メインアプリ (`apps/console`)                                |
| `console-shell`       | コンソールシェル lib                                         |
| `connect`             | 接続 lib                                                     |
| `page-not-found`      | 404 ページ lib                                               |
| `web-serial`          | Web Serial lib                                               |
| `example`             | サンプル lib                                                 |
| `wifi`                | Wi-Fi lib                                                    |
| `dialogs`             | ダイアログ lib                                               |
| `unsupported-browser` | 非対応ブラウザ lib                                           |
| `editor`              | エディタ lib                                                 |
| `terminal`            | ターミナル lib                                               |
| `pin-assign-panel`    | ピン割り当てパネル lib                                       |
| `shared`              | 共有 lib（guards / types / ui / util 統合）                  |
| `i2cdetect`           | I2C 検出 lib                                                 |
| `chirimen-setup`      | chirimen セットアップ lib                                    |
| `setup`               | `chirimen-setup` の別名（後方互換）                          |
| `file-manager`        | ファイルマネージャ lib                                       |
| `remote`              | リモート lib                                                 |
| `workspace`           | ルート・共通設定（package.json, nx.json, tsconfig, CI など） |

## 選び方

1. 影響が 1 つの lib / app に閉じる → その lib / app 名を選ぶ
2. ルート設定 / CI / husky / commitlint / docs 横断 → `workspace`
3. リポジトリ全体の運用ドocument → `workspace`
4. 複数 lib にまたがる変更は、可能なら commit / PR を分割する

## 廃止した scope（Issue #696 統合後）

以下は分割 lib 時代の scope です。新規コミットでは使用しない。

- `web-serial-util`, `web-serial-data-access`
- `shared-ui`, `shared-guards`, `shared-types`, `shared-util`
- `i2cdetect-ui`, `i2cdetect-data-access`, `i2cdetect-util`

## 採用しない scope（Issue #692 由来）

- `web-serial-rxjs` — 外部パッケージ
- `signal-store`, `ngrx`, `shared-store` — 専用 lib なし
- `connection`, `connection-guard` — `connect` / `shared` でカバー
- `auth`, `timezone`, `device-detection` — 該当 lib なし
- `i2c-detect` — `i2cdetect` を使用
- `menu`, `layout`, `theme`, `toolbar`, `router`, `settings` — `console` / `console-shell` で吸収
- `release`, `ci`, `docs` — `workspace` で吸収

## scope を追加したい場合

1. Nx generator で新 lib を作成（`nx-generate` skill を参照）
2. [commitlint.config.js](../../../commitlint.config.js) の `scope-enum` に追加
3. [CONTRIBUTING.md](../../../CONTRIBUTING.md) のスコープ表を更新
4. このファイルと [.cursor/rules/commit/20-chirimen-lite-console-scope.mdc](../../../.cursor/rules/commit/20-chirimen-lite-console-scope.mdc) を更新
