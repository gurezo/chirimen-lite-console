# コントリビューションガイド

本プロジェクトへの貢献ありがとうございます。コミットメッセージと開発環境のルールをまとめています。

## コミットメッセージ（Conventional Commits）

コミットメッセージは [Conventional Commits](https://www.conventionalcommits.org/) に準拠してください。

### 形式

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

- **type**: 変更の種類（`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `revert`）
- **scope**: 変更対象のスコープ（下記一覧から指定）
- **description**: 簡潔な説明（命令形・小文字始まり推奨）

### ヘッダ / ボディ / フッタ

Angular のコミットガイドラインに合わせ、コミットメッセージは「ヘッダ・ボディ・フッタ」で構成し、ヘッダとボディの間には空行を入れます。

- ヘッダ（必須）: `<type>(<scope>): <description>`
- ボディ（任意）: 変更の理由や背景（`docs` 型は省略可）
- フッタ（任意）: `BREAKING CHANGE:` など、互換性やリリース生成に関する情報

### 破壊的変更（BREAKING CHANGE）

破壊的変更を含む場合は、次のいずれかで明示してください。

- ヘッダに `!` を付ける: `<type>(<scope>)!: <description>`
- footer に `BREAKING CHANGE: <summary>` を書く（その後に移行手順・詳細を記載）

### スコープ一覧

`commitlint.config.js` の `scope-enum` と同一。現行 Nx プロジェクトと対応する。

| スコープ              | 説明                                                           |
| --------------------- | -------------------------------------------------------------- |
| `chirimen-setup`      | chirimen セットアップ lib（`libs/chirimen-setup`）             |
| `setup`               | `chirimen-setup` の別名（後方互換）                            |
| `console`             | メインアプリ (`apps/console`)                                  |
| `workspace`           | ルート・共通設定（package.json, nx, ツール設定など）           |
| `connect`             | 接続 lib（`libs/connect`）                                     |
| `console-shell`       | コンソールシェル lib（`libs/console-shell`）                   |
| `page-not-found`      | 404 ページ lib（`libs/page-not-found`）                        |
| `web-serial`          | Web Serial lib（`libs/web-serial`）                            |
| `example`             | サンプル lib（`libs/example`）                                 |
| `wifi`                | Wi‑Fi lib（`libs/wifi`）                                       |
| `dialogs`             | ダイアログ lib（`libs/dialogs`）                               |
| `unsupported-browser` | 非対応ブラウザ lib（`libs/unsupported-browser`）               |
| `editor`              | エディタ lib（`libs/editor`）                                  |
| `terminal`            | ターミナル lib（`libs/terminal`）                              |
| `file-manager`        | ファイルマネージャ lib（`libs/file-manager`）                  |
| `i2cdetect`           | I2C 検出 lib（`libs/i2cdetect`）                               |
| `pin-assign-panel`    | ピン割り当てパネル lib（`libs/pin-assign-panel`）              |
| `remote`              | リモート lib（`libs/remote`）                                  |
| `shared`              | 共有 lib（guards / types / ui / util を統合）                  |

### 例

- `feat(console): add dark mode toggle`
- `fix(terminal): prevent resize on reconnect`
- `build(workspace): add commitlint and husky for Conventional Commits`
- `docs(workspace): update CONTRIBUTING with scope list`

### Nx Release（Conventional Commits による自動バージョン決定）

Nx Release は、`nx.json` の `release.version.conventionalCommits` を `true` に設定した場合、最後のリリース以降の commit message を Conventional Commits として解釈し、バージョン bump を決めます。

- `fix` -> `patch`
- `feat` -> `minor`

## Git フック（husky）

`pnpm install` を実行すると、husky により `.husky` がセットアップされ、コミット時に `commit-msg` フックで commitlint が自動実行されます。不正な形式のメッセージではコミットが拒否されます。

初回クローン後は、必ずリポジトリルートで `pnpm install` を実行してください。

## パスエイリアス（tsconfig.base.json）

インポートには `tsconfig.base.json` の `compilerOptions.paths` で定義したエイリアスを使用します。

- **アプリ**: `@app/*` → `apps/console/src/app/*`
- **lib 群**: `@libs-<domain>` 形式（例: `@libs-shared`, `@libs-wifi`, `@libs-console-shell`）。各 lib は `libs/<domain>/src/index.ts` から公開 API を export する
- 一覧は `tsconfig.base.json` の `paths` を参照してください。実在する lib は `pnpm nx show projects` および [ARCHITECTURE.md](ARCHITECTURE.md) を確認する。

## 新規機能の置き場所

依存関係の層に合わせて、変更を置く lib を選ぶ。詳細な層構造と依存関係グラフは [ARCHITECTURE.md](ARCHITECTURE.md) を参照する。

| 層 | 置き場所の目安 | 例 |
| --- | --- | --- |
| shell | レイアウト・ルーティング・複数機能の束ね | `console-shell` |
| feature | 画面・ドメイン固有の機能 | `wifi`, `editor`, `file-manager`, `example` など |
| shared / 基盤 | 複数 feature から使う共通処理・Web Serial | `shared`, `dialogs`, `web-serial` |

- 特定機能に閉じる UI / ロジックは feature lib へ置く
- 複数 feature で再利用するものだけ `shared`（または `dialogs` / `web-serial`）へ上げる
- シェルへの依存を feature から増やさない（循環依存を避ける）

## プルリクエスト

- ブランチ名は Conventional Commits の意図が分かるようにしてください（例: `feat/console/add-dark-mode`）。
- プルリクエストのタイトルも Conventional Commits 形式を推奨します。
- `.github/pull_request_template.md` に沿って概要・変更内容・テスト方法を記載してください。

## AI による補助（Conventional Commits Skill / Rules）

Cursor などの AI コーディングエージェント向けに、本リポジトリ用の Conventional Commits 補助を導入しています。

- `.cursor/rules/commit/`
  - `00-conventional-commits.mdc` — 形式 / 許可 type / lowercase / imperative / 末尾ピリオド禁止
  - `10-pull-request-title.mdc` — PR タイトルの統一ルール
  - `20-chirimen-lite-console-scope.mdc` — 本プロジェクト固有 scope の選び方
- `.agents/skills/conventional-commits/`
  - `SKILL.md` / `examples.md` / `assertions.md` / `scopes.md`

scope の単一の真実は本ファイルの「スコープ一覧」と `commitlint.config.js` の `scope-enum` です。AI が生成したメッセージも、`pnpm install` 後は husky の `commit-msg` フックおよび CI の commitlint で検証されます。
