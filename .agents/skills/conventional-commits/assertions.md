# Conventional Commits Assertions (chirimen-lite-console)

AI が生成 / 提案するコミットメッセージや PR タイトルに対して満たすべき検証項目。

## 検証項目

- [ ] Conventional Commits の形式（`<type>(<scope>): <description>`）に一致しているか
- [ ] `type` が許可リスト（`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `revert`）にあるか
- [ ] `scope` が [commitlint.config.js](../../../commitlint.config.js) の `scope-enum` にあるか
- [ ] `description` が lowercase 始まりか
- [ ] `description` が命令形（imperative）か（`added` / `fixes` などになっていないか）
- [ ] `description` の末尾にピリオドがないか
- [ ] `description` が 72 文字を大きく超えていないか
- [ ] 破壊的変更がある場合に `!` または `BREAKING CHANGE:` が付与されているか
- [ ] `scope` と実際の変更対象（lib / app / workspace ルート）が一致しているか
- [ ] 1 commit / 1 PR に複数 scope の変更が混在していないか

## Valid サンプル

```
feat(console-shell): add serial connection banner
fix(web-serial-data-access): handle unexpected port close
refactor(shared-util): simplify session helpers
docs(workspace): update CONTRIBUTING with scope list
ci(workspace): tighten commitlint workflow trigger
build(workspace): bump @angular/* to 21.2.13
feat(web-serial)!: change session connection interface
```

## Invalid サンプル

| メッセージ                                  | 問題点                                  |
| ------------------------------------------- | --------------------------------------- |
| `fix stuff`                                 | 形式違反 (`type(scope): description`)   |
| `update console`                            | type なし                               |
| `Added new component`                       | type なし / 大文字 / 過去形             |
| `WIP`                                       | type / scope / description すべて欠落   |
| `chore(workspace): cleanup`                 | `chore` は許可されていない              |
| `feat(web-serial-rxjs): add observable`     | `scope-enum` に未登録の scope           |
| `feat(connection): add reconnect`           | `scope-enum` に未登録の scope           |
| `feat(console): Add dark mode.`             | 大文字始まり / 末尾ピリオド             |
| `fix(console): fixed bug`                   | 過去形（imperative 違反）               |
| `feat(console)!: change everything`         | description が雑 / 詳細不明             |

## 自動チェック

- 手元: `git commit` 時に `.husky/commit-msg` が `pnpm exec commitlint --edit $1` を実行
- CI: PR 作成時に [.github/workflows/commitlint.yml](../../../.github/workflows/commitlint.yml) が `pnpm exec commitlint --from <base> --to <head> --verbose` を実行
- 任意（ローカル検証）: `pnpm exec commitlint --from origin/main --to HEAD --verbose`
