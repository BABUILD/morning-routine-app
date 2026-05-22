# Morning Base Routine

毎朝5:05〜7:00のルーティーンを、場所・時間帯ごとにチェックして習慣化を支援するWebアプリ。

---

## ローカルで動かす

```bash
# 1. このフォルダに移動
cd morning-base-routine

# 2. 依存パッケージをインストール
npm install

# 3. 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:3000 を開くと動きます。

---

## Vercelで公開する（初回）

### 前提
- GitHubアカウント
- Vercelアカウント（GitHub連携でサインアップ）

### 手順

**1. GitHubにリポジトリを作る**

GitHub.com → New repository → `morning-base-routine` という名前で作成（Privateでも可）

**2. コードをpush**

```bash
cd morning-base-routine
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/あなたのユーザー名/morning-base-routine.git
git push -u origin main
```

**3. Vercelにインポート**

1. https://vercel.com/new を開く
2. GitHubのリポジトリを選択
3. 設定は **何も変えずに** Deploy ボタンを押す
4. 1〜2分で `https://morning-base-routine-xxx.vercel.app` のようなURLが発行される

**4. 次回からの更新**

```bash
git add .
git commit -m "変更内容"
git push
```
→ Vercelが自動でデプロイします。

---

## ファイル構成

```
morning-base-routine/
├── app/
│   ├── globals.css          # アニメーション・リセットCSS
│   ├── layout.jsx           # HTMLメタ情報・PWA設定
│   └── page.jsx             # ルートページ（薄いシェル）
├── components/
│   └── MorningBaseRoutine.jsx  # アプリ本体（UIすべて）
├── public/
│   ├── manifest.json        # PWAマニフェスト
│   ├── icon-192.png         # ★ 自分で用意（192×192px PNG）
│   └── icon-512.png         # ★ 自分で用意（512×512px PNG）
├── .gitignore
├── jsconfig.json
├── next.config.mjs
└── package.json
```

### アイコンの作り方（簡単）

無料ツール https://favicon.io/ などで 🌅 の絵文字アイコンをPNG出力して、
`public/icon-192.png` と `public/icon-512.png` として置くだけでOKです。

---

## あとからSupabase/Firebaseに拡張する場合

現在のデータ管理は `components/MorningBaseRoutine.jsx` の以下2箇所だけです：

```js
// 読み込み（useEffect内）
const raw = localStorage.getItem("mbr_data");

// 保存（useEffect内）
localStorage.setItem("mbr_data", JSON.stringify({...}));
```

この2箇所を Supabase の `upsert` / `select` に置き換えるだけで移行できます。
`app/page.jsx` がServer Componentになっているので、将来的にはそこで初期データをフェッチしてpropsで渡す構成にもできます。

---

## 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js 14 (App Router) |
| スタイル | インラインstyle + globals.css |
| 状態管理 | React useState / useEffect |
| データ永続化 | localStorage（日付ごと、90日分） |
| デプロイ | Vercel |
| 認証 | なし（MVP） |
