# Output Force — アウトプット強制システム

学習した内容を「フリーリコール」「3文要約」「実用例」「初心者への説明」の4タスクでアウトプットし、Obsidianに自動保存するローカルWebアプリ。

## 機能

- **4つのアウトプットタスク** — フリーリコール / 3文要約 / 実用例 / 初心者への説明
- **カテゴリ管理** — 技術・ビジネス・サイエンス・語学・その他
- **ステータス管理** — 待機中 / 進行中 / 完了
- **Obsidian連携** — データをMarkdown形式でOneDriveに自動保存（Remotely Save対応）
- **スマホ対応** — HTTPS + LAN経由で他デバイスからもアクセス可能
- **PWA対応** — Service Workerによるオフライン対応

## セットアップ

### 必要環境

- Node.js 18以上

### インストール・起動

```bash
git clone https://github.com/aauua16/output-force.git
cd output-force
npm install
npm start
```

またはWindowsの場合、`アプリ起動.bat` をダブルクリック。

### アクセス

- **このPC**: http://localhost:3000
- **他のデバイス（スマホ等）**: https://＜PCのIPアドレス＞:3443（初回は「安全でない」警告を許可）

## データ保存先

```
OneDrive/アプリ/remotely-save/wallfacer/
```

Obsidianの [Remotely Save](https://github.com/remotely-save/remotely-save) プラグインと組み合わせると、スマホとも同期可能です。

## 注意

- `cert/`（SSL証明書）と `data/`（個人データ）はGitに含まれません
- SSL証明書は初回起動時に自動生成されます
- `node_modules/` は `npm install` で再生成してください
