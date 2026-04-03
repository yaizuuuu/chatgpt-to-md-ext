# GenAI Chat to Markdown

ChatGPT・Claude.ai のチャットをMarkdownに変換してクリップボードにコピーするChrome拡張機能です。

## 機能

- チャットページで右クリック →「Convert chat to Markdown」を選択
- 会話内容がMarkdown形式でクリップボードにコピーされます
- `## User` / `## Assistant` の見出しでメッセージを区切り、コードブロックはfenced style（` ``` `）で出力

## 対応サイト

- [ChatGPT](https://chatgpt.com)
- [Claude](https://claude.ai)

## インストール

```bash
npm install
npx lefthook install
npm run build
```

1. Chrome で `chrome://extensions` を開く
2. 「デベロッパーモード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」からプロジェクトルートを選択

## 開発

```bash
npm run watch     # ファイル変更時に自動ビルド
npm run check     # format & lintに準拠しているか確認
npm run check:fix # format & lintに準拠するように修正
```

ビルド後、Chrome の拡張機能ページでリロードボタンを押すと変更が反映されます。
