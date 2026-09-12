# TanStack DB 実習

同じ課題トラッカーを左右で同時に動かします。左は TanStack DB、右は `useState` と `await` です。GitHub Pages 向けの静的アプリです。

公開 URL は https://okrago10.github.io/TanstacDB-practice/ です。初回はリポジトリの Settings → Pages で Source を GitHub Actions にしてください。`main` への push で `dist` をデプロイします。

## 手元で動かす

Node.js 22 を入れてから、次を実行します。

1. `npm install`
2. `npm run dev`
3. 表示された URL をブラウザで開く

`npm test` と `npm run build` が通ることを確認してから push します。

## 見るところ

フィルタは左右で同じです。未着手を完了すると、左はすぐ消え、右は遅延のあと消えます。下部のメーターが絞り込み、画面反映、保存完了、再描画を出します。教材ファイルは `src/db-session.ts` です。
