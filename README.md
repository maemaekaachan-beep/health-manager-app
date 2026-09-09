## クラウドDB (Vercel Postgres) セットアップ

このアプリはデータを localStorage ではなく Vercel Postgres (Neon統合) に保存する。ログイン機能はなく、`/api/*` は誰でも呼べる状態になる点に注意(個人利用のみを想定。心配な場合は Vercel の「Password Protection」機能を有効にする)。

### 初回セットアップ

1. Vercel ダッシュボードでこのプロジェクトに Postgres (Neon統合) を追加する。
2. スキーマ作成(初回のみ): デプロイ後に一度だけ `curl -X POST https://<デプロイURL>/api/init-db` を実行する。
   - Neon統合が発行する `DATABASE_URL` 等は Vercel 側で「Sensitive」指定されており、`vercel env pull` ではローカルに値を取得できない(空文字になる)。そのためローカルの `scripts/init-db.mjs` 経由では実行できず、`api/init-db.ts` をVercel上で直接叩く方式にしている。
   - ローカルで `scripts/init-db.mjs` を使いたい場合は、Vercelダッシュボードの Environment Variables で該当変数の「Sensitive」を解除してから `vercel env pull .env.local` する。
3. `/api/init-db` は `CREATE TABLE IF NOT EXISTS` のみで何度呼んでも安全(データを壊さない)。
4. ローカル開発時、`/api` はローカルでは呼べない(同じくSensitive変数の制約で `vercel dev` でもDBに繋がらない)ため、DB絡みの動作確認は実際にデプロイして行う。

### PCとスマホのデータを統合する手順

1. PC・スマホそれぞれで、アプリの「プロフィール」タブ →「JSONでエクスポート」で現在のlocalStorageデータを書き出す。
2. クラウド対応版をデプロイした状態で、まずPCで「JSONから復元」→ 書き出したPC分を **上書き** モードでインポート(クラウドDBがPCのデータで初期化される)。
3. スマホで同じURLを開くと、PCのデータが自動的に表示される。
4. スマホにしかない記録がある場合は、スマホの「JSONから復元」→ 書き出したスマホ分を **マージ(追加)** モードでインポート(重複せずに追加される)。
5. 以降はPC・スマホどちらでアクセスしても同じクラウドDBを参照するため、データは自動的に一元化される。

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
<!-- demo deploy trigger -->
