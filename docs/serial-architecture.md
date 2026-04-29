# Web Serial の責務分界（web-serial-rxjs と chirimen-lite-console）

本ドキュメントは [issue #568](https://github.com/gurezo/chirimen-lite-console/issues/568) の趣旨に沿い、汎用ライブラリ **@gurezo/web-serial-rxjs** と本リポジトリ **chirimen-lite-console** の責務境界、および受信ストリームの使い分けをまとめる。実装の詳細（各サービス名・マルチキャスト等）は [libs/web-serial/data-access/README.md](../libs/web-serial/data-access/README.md) を参照。

## リポジトリ別の責務（概要）

```text
web-serial-rxjs（@gurezo/web-serial-rxjs）
  └─ 汎用 serial 通信
      ├─ connect / disconnect
      ├─ send
      ├─ receive（生チャンク）
      ├─ state
      ├─ errors
      └─ lines（行分割ストリーム）

chirimen-lite-console（本リポジトリ）
  └─ CHIRIMEN / Pi Zero 固有処理
      ├─ browser check
      ├─ device check（フィルタ・接続フロー）
      ├─ login
      ├─ environment setup（初期化コマンド・シェル準備）
      ├─ command execution（キュー・プロンプト待ち・retry 等）
      └─ terminal UI（表示用パイプ・ViewModel）
```

**原則**: ブラウザの Web Serial 上で「どのボードでも再利用できる」送受信・セッション状態管理は **web-serial-rxjs** に置く。ボード ID・ログインシーケンス・プロンプト文字列・アプリ固有のコマンドオーケストレーション・xterm 等の UI は **本リポジトリ** に置く。

## `SerialSession` と本アプリの薄いラッパー（issue #557 との対応）

本リポジトリでは `SerialSession`（`state$` / `isConnected$` / `errors$` 等）を **接続状態などの唯一のソース** とし、[`SerialTransportService`](../libs/web-serial/data-access/src/lib/serial-transport.service.ts) は `activeSession$` 経由内の **橋渡し（thin adapter）** に留める。Pi Zero 向けの接続・ログイン・初期化は `PiZeroSessionService` やオーケストレーション層に集約し、機能コンポーネントから `SerialTransportService` を直接注入しない方針とする（[`SerialFacadeService`](../libs/web-serial/data-access/src/lib/serial-facade.service.ts) 経由）。

## 受信ストリーム `receive$` / `receiveReplay$` / `lines$`

いずれも **ライブラリの `SerialSession`** が提供する。意味の整理は次のとおり。

| ストリーム | ライブラリ側の意味 |
|------------|-------------------|
| `receive$` | 生の受信チャンク。**リプレイなし**。購読開始以降のデータのみ。 |
| `receiveReplay$` | 生チャンク。**後から購読しても直近までのバッファから再送されやすい**（UI が遅れて購読しても欠けにくい用途向け）。 |
| `lines$` | 行境界で分割された **行** のストリーム。プロンプト判定やコマンド結果の行処理向け。 |

### 本アプリでの推奨利用

詳細な対応表は [`libs/web-serial/data-access/README.md`](../libs/web-serial/data-access/README.md) を正とする。要約すると次のとおり。

- **ターミナル表示（xterm 等・生データのライブ／リプレイ表示）**  
  - `receiveReplay$` 相当（ファサードでは `terminalOutput$`）。
- **コマンド実行・プロンプト待ち・ログイン判定など「行」単位の処理**  
  - `lines$` と同根の **`commandResultLines$` / `getReadStream()`**（複数購読で行が取り合いにならないようマルチキャスト）。**プロンプト検出に `receiveReplay$` 単体は寄せない**（チャンク境界と ANSI・行処理の齟齬を避ける）。
- **単一購読で `SerialSession.lines$` をそのまま見たい場合**  
  - `lines$` の素の橋渡し。
- **リプレイ不要な生チャンクが必要な場合**  
  - `receive$`。

## 新規実装をどちらのリポジトリに置くか

| 判断 | 置き場所の目安 |
|------|----------------|
| 新しいボード・ベンダーと無関係な送受信 API、セッション寿命、汎用 Observable 設計 | **web-serial-rxjs** |
| Raspberry Pi Zero / CHIRIMEN 固有のフィルタ、ログイン、初期化シーケンス、プロンプト定義、ターミナル画面との連携 | **chirimen-lite-console**（通常は `libs/web-serial` や `libs/terminal`） |

迷った場合は、**「他プロジェクトにそのままコピーしても意味が通るか」** で区切るとよい。通るならライブラリ、CHIRIMEN Lite Console 前提なら本リポジトリ。

## 関連 Issue

- [#557](https://github.com/gurezo/chirimen-lite-console/issues/557) — `SerialSession` を正としたアプリ側の薄型化（本ドキュメント執筆時点でコード上の受け入れ条件を満たしている旨を PR で確認済みとする想定）
- [#568](https://github.com/gurezo/chirimen-lite-console/issues/568) — 本ドキュメントの追加
