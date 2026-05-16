# CHIRIMEN Lite Console

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 20.x. It uses [Nx](https://nx.dev) as the monorepo build system.

## プロジェクト構成

- **apps/console** — メインの Web アプリ（CHIRIMEN Lite 接続・ターミナル・エディタ・Wi‑Fi 設定など）
- **libs/** — 機能別ライブラリ（connect, console-shell, dialogs, editor, example, file-manager, i2cdetect, pin-assign-panel, remote, setup, shared, terminal, web-serial, wifi など）。`tsconfig.base.json` の `paths` と [CONTRIBUTING.md](CONTRIBUTING.md) のスコープ一覧を参照してください。

## 📚 リファクタリング履歴

このプロジェクトは段階的なリファクタリングを経て、保守性と拡張性の高いアーキテクチャに進化しています。

- **Step 1**: Serial サービスの責任分散（`memos/step1/`）
- **Step 2**: 不要コードの削除（`memos/step2/`）
- **Step 3**: 最終クリーンアップ（`memos/step3/`）
- **Step 4**: porting/ と shared/ の統合（`memos/step4/`） ⭐ NEW

詳細は各ステップの `README.md` を参照してください。

## 開発サーバー

```bash
pnpm start
```

または

```bash
pnpm nx run console:serve
```

ブラウザで `http://localhost:4200/` を開きます。ソース変更時に自動リロードされます。

## ビルド

```bash
pnpm build
```

または

```bash
pnpm nx run-many -t build
```

ビルド成果物は `dist/` に出力されます。

## ユニットテスト

```bash
pnpm test
```

または

```bash
pnpm nx run-many -t test
```

Vitest で全プロジェクトのユニットテストを実行します。

## AI エージェント向け設定（Cursor Skills / Rules）

本プロジェクトは Cursor などの AI コーディングエージェントが Angular / Nx Workspace の構造とベストプラクティスを理解できるよう、以下の Skills / Rules を導入しています。

### Angular Skills

[Angular 公式 Skills](https://github.com/angular/skills) を `.agents/skills/` 配下に導入しています。

- `angular-developer` — Angular の一般的な開発知識（コンポーネント / Signals / DI / ルーティング / フォーム / テストなど）
- `angular-new-app` — Angular 新規アプリ作成のガイダンス

再導入する場合は以下を実行してください。

```bash
npx skills add https://github.com/angular/skills
```

### Nx AI Agent 設定

[Nx AI Agents](https://nx.dev/blog/nx-ai-agent-skills) により、Nx Workspace 構造を AI に理解させるための Skills (`nx-workspace` / `nx-generate` / `nx-run-tasks` ほか)、Nx Console (MCP) 連携、ルート `AGENTS.md`、`.cursor/agents/` 配下のサブエージェント定義を導入しています。

再設定する場合は以下を実行してください。

```bash
pnpm nx configure-ai-agents
```

### Cursor Rules (`.mdc`)

`.cursor/rules/` 配下に責務別の Rules を配置しています。

```
.cursor/rules/
├── angular/
│   ├── 00-angular-core.mdc       # Angular ベースライン
│   ├── 10-angular-signals.mdc    # Signals の使い分け
│   ├── 20-angular-components.mdc # Component 設計
│   └── 30-angular-testing.mdc    # テスト方針
├── nx/
│   ├── 00-nx-workspace.mdc       # Workspace 全体ルール
│   ├── 10-nx-generators.mdc      # Nx Generator 利用方針
│   └── 20-nx-tasks.mdc           # Nx タスク実行方針
└── workflow/
    └── 90-ai-workflow.mdc        # AI 編集時の共通ルール
```

各 `.mdc` は `globs` で対象ファイルを限定しているため、対象ファイルを Cursor で開くと自動でルールが参照されます。

詳細は Issue [#690](https://github.com/gurezo/chirimen-lite-console/issues/690) を参照してください。

## その他

- コード生成や開発のルールは [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。
- Angular CLI の詳細は [Angular CLI Overview](https://angular.dev/tools/cli) を参照してください。
