# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ChatGPT・Claude.aiのチャット画面からHTML会話を抽出し、Markdownに変換してクリップボードにコピーするChrome拡張機能（Manifest V3）。

## Build Commands

```bash
npm run build   # esbuildでbackground.ts, content.tsをバンドル → dist/
npm run watch   # 同上のwatch mode
```

ビルド成果物は `dist/background.js` と `dist/content.js`。テストスイートは未導入。

## Architecture

エントリポイントは2ファイル。共有型定義と実装モジュールは `src/` に分離：

- **`background.ts`** — Service Worker。コンテキストメニュー登録・クリックハンドラ・メッセージリスナーのみ
- **`content.ts`** — ページ上で実行されるコンテンツスクリプト（IIFE）。オーケストレーションのみ（各モジュールを呼び出す）
- **`src/constants.ts`** — 複数ファイルから参照される定数群
- **`src/turndown-rules.ts`** — TurndownService生成（`createTurndownService`）と画像ルール追加（`addImageRules`）
- **`src/messages.ts`** — サイト別DOM抽出（`getMessages`, `getClaudeMessages`, `getChatGPTMessages`）
- **`src/images.ts`** — 画像収集ユーティリティ（`collectImages` とヘルパー関数群）
- **`src/download.ts`** — background側ダウンロードヘルパー（`handleSaveWithImages`, `downloadFile`, `sanitizeFolderName`）

esbuildがビルド時に `src/` モジュールを各エントリポイントへバンドルする。

### サイト固有のDOM抽出

| サイト | ターンのセレクタ | User | Assistant |
|---|---|---|---|
| claude.ai | `#main-content [data-test-render-count]` | `[data-testid='user-message']` | `.font-claude-response .standard-markdown` |
| chatgpt.com | `#main section[data-turn]` | `data-turn="user"` 属性 | `data-turn="assistant"` 属性 |

これらのセレクタは各サイトのDOM構造に依存するため、サイト側の変更で壊れる可能性がある。

### Markdown変換

TurndownServiceを使用。コードブロックはfenced style（\`\`\`）、リスト項目は余分な空白をtrimするカスタムルールあり。出力は `## User` / `## Assistant` 見出しでメッセージを区切る。

## Manual Testing

1. `npm run build`
2. Chrome → `chrome://extensions` → 「パッケージ化されていない拡張機能を読み込む」でプロジェクトルートを指定
3. chatgpt.com または claude.ai のチャットページで右クリック →「Convert chat to Markdown」
4. クリップボードにMarkdownがコピーされ、アラートが表示されることを確認
