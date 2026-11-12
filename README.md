<div align="center">

# ⚡ Output Force

**学んだら、書く。インプットで終わらせない「アウトプット強制」アプリ。**

[![HTML](https://img.shields.io/badge/HTML-single%20file-E34F26?logo=html5&logoColor=white)](static/index.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

<p align="center"><img src="docs/screenshot.png" width="640" alt="Output Force"></p>

学習した内容を **4つのタスク** でアウトプットし、**Obsidian 向けの Markdown** として好きなフォルダに直接保存する、サーバー不要のローカルアプリです。

| タスク | 狙い |
| --- | --- |
| 🧠 フリーリコール | 見返さずに思い出せるだけ書き出す |
| 📝 3文要約 | 本質だけを3文に圧縮する |
| 🔧 実用例 | 実生活・仕事での使い方に落とす |
| 🗣️ 初心者への説明 | 平易な言葉で説明して理解の穴を見つける |

## ✨ Features

- 🏷️ **カテゴリを自由に編集** — 研究・関心領域に合わせて追加・改名・削除(設定 → カテゴリ)。改名すると既存の記録も更新
- 📝 frontmatter 付き Markdown で保存 — Obsidian の Vault にそのまま置ける
- 🔒 サーバー・アカウント不要。データはブラウザとあなたのフォルダだけに保存
- ⏳ 未完了が3件たまると新規インプットをブロックする「強制」機構

## 🚀 使い方

### A. アプリとして使う(Windows・おすすめ)

1. [`scripts/install-app.bat`](scripts/install-app.bat) をダブルクリック
2. デスクトップとスタートメニューに **Output Force** ができます(アドレスバーのない専用ウィンドウで起動)
3. 初回のみ **設定 → 📁 フォルダを選択** で保存先(例: Vault 内の `06-アウトプット/…`)を選ぶ

Chrome または Edge が必要です。アプリ専用のプロファイルを使うので、普段のブラウザとデータは混ざりません。

### B. HTML を直接開く

[`static/index.html`](static/index.html) を Chrome / Edge で開くだけでも動きます。

## 🗂️ Project Structure

```
output-force/
├── static/index.html   # アプリ本体(単一ファイル)
├── assets/             # アイコン
├── scripts/            # アプリ化(ショートカット作成)
└── LICENSE
```

## 🔐 Notes

- 保存先フォルダへの書き込みは、ブラウザの File System Access API で、選んだフォルダに限って許可されます。
- 既存ノートのうち、Output Force 形式(frontmatter に `id` がある)のものだけを取り込みます。他のファイルには触れません。

## 📄 License

[MIT](LICENSE)
