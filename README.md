# ABI Trace Viewer

<img width="504" alt="image" src="https://github.com/user-attachments/assets/2e77b7a8-17a3-4f7e-afa4-b4b8f82e18f8" />

このリポジトリは、以下を提供するための一式です。
- サンガーシーケンスの `.ab1` ファイルを解析し、WEBブラウザ上で波形/配列情報を表示します
- Apache のサブディレクトリ（`/abi`）配下で動作するように調整済みのフロントエンド

概要
- ブラウザで AB1 ファイルをドラッグ&ドロップして、ピーク波形と配列（FASTA）を表示

ディレクトリ構成
- `ab1_site/server.py`: Flask アプリ（静的配信 + API）。`/abi` 配下にマウント。
- `ab1_site/DEPLOY.md`: サーバ（別環境）への導入手順の詳細ドキュメント。

クイックスタート（ローカル）
1) 依存インストール（推奨: 仮想環境）
```
cd ab1_site
python3 -m venv .venv && source .venv/bin/activate
pip install --upgrade pip
pip install flask biopython
```
2) アプリ起動（開発サーバ）
```
python server.py
```
3) ブラウザでアクセス
```
http://localhost:8000/abi/static/ChiBioTools/src/ab1_file.html
```
4) 画面のドロップ領域へ `.ab1` ファイルをドラッグ&ドロップ

> 本番運用は `gunicorn` 推奨: `gunicorn -w 2 -b 127.0.0.1:8000 'server:create_app()'`

API 仕様（フロントが利用）
- `GET /abi/xiaochi/gettoken`
  - 例: `{ "token": "local-dev-token", "expires_in": 3600 }`
- `POST /abi/ChiBioTools/getAb1Data`（multipart/form-data, フィールド名: `file`）
  - レスポンス例:
```
{
  "summary": [{"file name": "sample.ab1", "base count": 1234, "trace length": 16789}],
  "baseData": "base_symbol\tbase_location\tbase_quality\nA\t123\t38\n...",
  "peakData": {
    "length": 16789,
    "channels": ["G","A","T","C"],
    "G": [..], "A": [..], "T": [..], "C": [..]
  }
}
```

Apache のサブディレクトリ `/abi` での公開
- 本アプリは `/abi` プレフィックスで動作するように構成済みです。
- 代表例（リバースプロキシ）:
```
<Location /abi/>
  ProxyPass http://127.0.0.1:8000/abi/
  ProxyPassReverse http://127.0.0.1:8000/abi/
  RequestHeader set X-Forwarded-Prefix "/abi"
</Location>
```
- 詳細は `ab1_site/DEPLOY.md` を参照してください。

ポート変更（8000 → 8080 など）
- 直接起動: `server.py` 末尾の `app.run(..., port=8080, ...)` を変更。
- gunicorn: `-b 127.0.0.1:8080` に変更。
- Apache の `ProxyPass` 転送先ポートも合わせてください。

自動起動手順 (server.pyのport 8000をport 8080に変更した場合)
- `sudo cp ab1_site/systemd/abi.service /etc/systemd/system/abi.service`
- `sudo systemctl daemon-reload`
- `sudo systemctl enable --now abi.service`
- 確認: `systemctl status abi.service`

トラブルシュート
- 500 エラー時はアプリログを確認:
  - 開発起動: `/tmp/ab1_flask.log`
  - systemd 運用: `journalctl -u abi.service`
- 一部 AB1 のトレースタグ差異で波形抽出が空になる場合があります（典型は DATA9–12, フォールバック DATA1–4）。その際は `server.py` のタグ解決を調整してください。

ライセンス / 出典
- 元ページは chiplot.online の公開ページをもとに作成しています。社内/閉域での利用を想定しています。
- 本リポジトリ内のコードは当該用途（内部利用）向けに最小限に再構成したものです。

