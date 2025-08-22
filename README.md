# ABI Trace Viewer (Client‑only)

<img width="504" alt="image" src="https://github.com/user-attachments/assets/2e77b7a8-17a3-4f7e-afa4-b4b8f82e18f8" />

このリポジトリは、サンガーシーケンスの `.ab1` ファイルをブラウザ内（クライアントのみ）で解析し、波形と配列（FASTA）を表示する静的Webツールです。サーバやPythonのバックエンドは不要です。

概要
- エントリーポイント: `web/index.html`
- ブラウザで `.ab1` をドラッグ&ドロップ → 波形とFASTAを表示（ローカルで完結）

ディレクトリ構成
- `web/`: 静的サイト本体（`index.html`, `static/`, `vendor/`）
- `example/`: サンプルの `.ab1` ファイル

ローカルでの起動（静的ホスティング）
- Pythonの簡易サーバを使用する例:
  - `python3 -m http.server 8000 --directory web`
  - ブラウザで `http://localhost:8000/` を開く
- あるいは VSCode の Live Server 等、任意の静的サーバをご利用ください

使い方
- 画面のドラッグ領域に `.ab1` をドロップ/選択すると、ブラウザ内で解析して波形/FASTAを表示します

補足
- 一部のブラウザでは `file://` 直接開きだと ES Modules の読み込み制限があるため、上記のような簡易サーバで配信して利用してください

ライセンス / 出典
- 元ページは chiplot.online の公開ページをもとに作成しています。社内/閉域での利用を想定しています。
- 本リポジトリ内のコードは当該用途（内部利用）向けに最小限に再構成したものです。
