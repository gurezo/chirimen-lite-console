# libs-i2cdetect

I2C デバイス検出用ライブラリ。

## 現状

- 他の lib / app から `@libs-i2cdetect` 経由で import されている箇所は **ない**
- ツールバーの I2C アクションは [console-shell](../console-shell) がターミナル経由で `i2cdetect -y 1` を直接送信している

## 方針

将来の I2C 専用 UI 実装に備え、本 lib を placeholder として維持する。

- `I2cdetectService` … シリアル経由で i2cdetect を実行し、結果を HTML 形式で整形
- `formatI2cdetectResult` … 生出力の整形ユーティリティ

lib 本体・tsconfig パスは削除しない。
