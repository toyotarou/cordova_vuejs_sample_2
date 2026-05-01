# TarotApp

Apache Cordova + Vue 3 製の Android アプリ。外部 API から取得した JSON データをもとに、タロットカードの引き履歴を月間カレンダー形式で表示します。

---

## アプリ情報

| 項目 | 値 |
|---|---|
| アプリ名 | TarotApp |
| パッケージ ID | com.example.tarotapp |
| バージョン | 1.0.0 |
| ライセンス | Apache-2.0 |

---

## 対応プラットフォーム

- **Android** (cordova-android ^14.0.1)

---

## 主な機能

| 機能 | 説明 |
|---|---|
| **月間カレンダー表示** | 各日付に引いたタロットカードの画像を表示 |
| **正位置 / 逆位置** | 逆位置のカードは画像を 180° 回転して表示 |
| **吉凶オーバーレイ** | カード画像の上に吉凶（○ / ×）を重ねて表示 |
| **詳細ダイアログ** | カードをタップすると日付・カード名・正逆位置バッジ・キーワードをダイアログで表示 |
| **月ナビゲーション** | 前月・次月ボタンで切り替え。履歴データの範囲外には移動不可 |

---

## 使用ライブラリ・フレームワーク

| 名前 | バージョン | 用途 |
|---|---|---|
| [Vue 3](https://vuejs.org/) | ^3.5.32 | UI フレームワーク |
| [Onsen UI](https://onsen.io/) | ^2.12.8 | モバイル向け UI コンポーネント |
| vue-onsenui | ^3.0.0 | Onsen UI の Vue バインディング |
| [Vite](https://vitejs.dev/) | ^5.0.0 | ビルドツール・開発サーバー |

---

## 外部 API

| エンドポイント | 説明 |
|---|---|
| `http://toyohide.work/BrainLog/api/tarothistory` | タロット引き履歴（年・月・日・カード名・画像・正逆位置・キーワード） |
| `http://toyohide.work/BrainLog/api/getAllTarot` | 全タロットカード情報（カード名・正位置の吉凶・逆位置の吉凶） |
| `http://toyohide.work/BrainLog/tarotcards/{image}.jpg` | タロットカード画像 |

---

## Android 設定 (config.xml)

| 設定項目 | 値 |
|---|---|
| usesCleartextTraffic | true |
| AndroidInsecureFileModeEnabled | true |

---

## プロジェクト構成

```
cordova_vuejs_sample_2/
├── cordova/                  # Cordova Android プロジェクト
│   ├── config.xml            # Cordova 設定ファイル
│   ├── package.json          # Cordova 依存関係
│   ├── res/                  # アイコン等リソース
│   └── www/                  # Vite ビルド出力先
└── vue/
    └── tarotapp/             # Vue 3 フロントエンド
        ├── index.html        # エントリーポイント
        ├── vite.config.js    # Vite 設定
        ├── package.json      # npm 依存関係
        └── src/
            ├── main.js       # Vue マウント
            ├── App.vue       # メインコンポーネント（カレンダー・ダイアログ）
            ├── style.css     # グローバルスタイル
            └── assets/       # 静的アセット
```

---

## セットアップ・ビルド

```bash
# 1. Vue アプリをビルド
cd vue/tarotapp
npm install
npm run build

# 2. ビルド成果物を Cordova の www/ にコピー
cp -r dist/* ../../cordova/www/

# 3. Android ビルド
cd ../../cordova
npm install
npx cordova build android
```
