---
name: conventional-commits
description: Generates Conventional Commits compliant commit messages and pull request titles for the chirimen-lite-console workspace. Trigger when authoring commit messages, drafting PR titles or descriptions, reviewing whether existing commits follow Conventional Commits, or when the user mentions commitlint, scope, scope-enum, breaking change, semantic-release, nx release, or release notes. Aligns with the project's commitlint.config.js scope-enum and CONTRIBUTING.md.
metadata:
  version: '1.0'
---

# Conventional Commits Skill (chirimen-lite-console)

このスキルは、`chirimen-lite-console` の Angular + Nx モノレポ構成と `commitlint.config.js`（`@commitlint/config-angular` 継承）の運用に最適化した Conventional Commits を生成するためのものです。

## 前提

- Angular + Nx モノレポ
- パッケージマネージャ: `pnpm`
- commitlint は導入済み（`.husky/commit-msg` で `pnpm exec commitlint --edit "$1"` を実行）
- GitHub Actions（[.github/workflows/commitlint.yml](../../../.github/workflows/commitlint.yml)）で PR の commit 群を検証
- scope の単一の真実は [commitlint.config.js](../../../commitlint.config.js) の `scope-enum`
- 詳細は [CONTRIBUTING.md](../../../CONTRIBUTING.md) のスコープ表を参照

## コミットメッセージ形式

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

- ヘッダ（必須）: `<type>(<scope>): <description>`
- ボディ（任意）: 変更の理由や背景。空行を 1 行入れて記載
- フッタ（任意）: `BREAKING CHANGE: ...` / `Closes #<n>` / `Refs #<n>`

## 許可 type

`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `revert`

## description の書式

- lowercase 始まり
- 命令形（imperative）— 例: `add` / `fix` / `update`
- 末尾ピリオドなし
- 72 文字以内を目安に簡潔に

## scope の選び方

1. 影響が Nx の特定 lib / app に閉じる → その lib / app 名を scope に
2. ルート設定（package.json, nx.json, tsconfig, GitHub Actions, husky, commitlint 等）の変更 → `workspace`
3. ドキュメント単独の変更でも、最も関係する scope を選ぶ。リポジトリ横断の場合は `workspace`

scope 一覧は [scopes.md](scopes.md) を参照。`commitlint.config.js` の `scope-enum` を超えた scope は使用しない。

## 破壊的変更（BREAKING CHANGE）

- ヘッダに `!`: `feat(web-serial)!: change session connection interface`
- もしくはフッタに `BREAKING CHANGE: <summary>` を記述

## PR タイトル

PR タイトルも Conventional Commits に統一する。1 PR = 1 type / 1 scope を基本とし、`Closes #<n>` / `Fixes #<n>` は PR 本文の `Related issues` セクションに記載する。

## カテゴリ別ガイド

### Angular コンポーネント / UI 変更

```
feat(console): add dark mode toggle
refactor(console-shell): split toolbar into smaller components
fix(dialogs): prevent duplicated open events
```

### Web Serial 関連

```
feat(web-serial): add reconnect strategy
fix(web-serial-data-access): handle unexpected port close
refactor(web-serial-util): simplify port detection
```

### Terminal / Editor

```
fix(terminal): prevent resize on reconnect
feat(editor): add Monaco theme switcher
```

### Shared lib（共通）

```
refactor(shared-util): simplify session helpers
feat(shared-ui): add status badge component
fix(shared-guards): redirect when serial is disconnected
```

### CI / Release / Workspace

```
ci(workspace): tighten commitlint workflow trigger
build(workspace): bump @angular/* to 21.2.13
docs(workspace): update CONTRIBUTING with scope list
```

## 参照ファイル

- [examples.md](examples.md) — 良い例 / 悪い例
- [assertions.md](assertions.md) — 検証項目と Valid / Invalid サンプル
- [scopes.md](scopes.md) — scope 一覧と用途（`commitlint.config.js` と同期）
- [CONTRIBUTING.md](../../../CONTRIBUTING.md) — リポジトリ全体のコントリビュートルール

## 将来連携

- 本リポジトリは [nx.json](../../../nx.json) の `release.version.conventionalCommits` を有効化することで Conventional Commits から bump 種別（`fix` → patch / `feat` → minor）を自動決定できる。
- 一貫した commit message は changelog 自動生成 / semantic-release / Nx Release の前提となる。
