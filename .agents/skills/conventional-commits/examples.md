# Conventional Commits Examples (chirimen-lite-console)

`commitlint.config.js` の `scope-enum` に整合した、本リポジトリで実際に使用できる例。

## 良い例

### feat

```
feat(console): add dark mode toggle
feat(console-shell): add connection status indicator
feat(web-serial): add reconnect strategy
feat(editor): add Monaco theme switcher
feat(terminal): add auto scroll on output
feat(shared-ui): add status badge component
```

### fix

```
fix(terminal): prevent resize on reconnect
fix(web-serial-data-access): handle unexpected port close
fix(dialogs): prevent duplicated open events
fix(shared-guards): redirect when serial is disconnected
fix(i2cdetect-ui): align device list rows
```

### refactor

```
refactor(console-shell): split toolbar into smaller components
refactor(web-serial-util): simplify port detection
refactor(shared-util): simplify session helpers
refactor(remote): extract command parser
```

### docs / build / ci / test / perf / style / revert

```
docs(workspace): update CONTRIBUTING with scope list
docs(console): document dark mode usage
build(workspace): bump @angular/* to 21.2.13
ci(workspace): tighten commitlint workflow trigger
test(web-serial): cover reconnect timing
perf(terminal): debounce resize handler
style(console): apply prettier formatting
revert(workspace): revert "build(workspace): bump nx to 22.7.2"
```

### 破壊的変更

```
feat(web-serial)!: change session connection interface

BREAKING CHANGE: SerialSession.connect() now returns Promise<Result>
instead of Promise<void>. Callers must handle the new return shape.
```

## 悪い例（避ける）

```
update files
fix issue
WIP
Refactoring
Added New Feature.
feat: Added New Feature.
fix(console): Fix bug.
feat(web-serial-rxjs): add observable          # scope-enum に存在しない
chore(workspace): cleanup                       # chore は許可されていない
feat(console)!: BREAKING CHANGE in dark mode    # description が雑
```

### よくある誤り

- `chore` を使う → 許可されていない。`build` / `ci` / `docs` / `refactor` のいずれかに分類する
- `web-serial-rxjs` / `signal-store` / `connection` などを scope に使う → `scope-enum` に存在しない
- description の先頭を大文字 / 過去形 / 末尾ピリオド → ルール違反
- 1 commit に複数 scope の変更が混在する → なるべく分割する
