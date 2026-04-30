# Tarot App 開発ログ

Vue.js + Vite + Onsen UI を使ったタロット履歴カレンダーアプリの作成記録。
最終的には Cordova で Android アプリとしてビルドする想定。

---

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────┐
│  Vue.js アプリ（vue/tarotapp/）                   │
│  ・画面の描画・ロジックをすべて担当               │
│  ・Vite でビルドして静的ファイル（dist/）を生成  │
└──────────────────┬──────────────────────────────┘
                   │ npm run build → dist/ をコピー
                   ▼
┌─────────────────────────────────────────────────┐
│  Cordova アプリ（cordova/www/）                  │
│  ・Vue でビルドした HTML/JS/CSS をそのまま配置   │
│  ・Android の WebView がそれを表示する           │
│  ・ネイティブ機能（カメラ等）は Cordova Plugin  │
│    経由でアクセスできる                          │
└──────────────────┬──────────────────────────────┘
                   │ cordova build android
                   ▼
┌─────────────────────────────────────────────────┐
│  app-release.apk                                │
│  ・Android 端末にインストールできるファイル      │
└─────────────────────────────────────────────────┘
```

### なぜ Vue + Cordova か

| 手法 | 特徴 |
|---|---|
| **Vue + Cordova（本プロジェクト）** | Web 技術でアプリを書き、WebView でラップして APK 化。HTML/CSS/JS の知識がそのまま使える |
| React Native / Flutter | ネイティブコンポーネントに変換。パフォーマンスは高いが学習コストも高い |
| PWA | ブラウザで動くが、ホーム画面追加やオフライン対応に限界がある |

Cordova の本質は「HTML ファイルを表示する Android アプリの殻」。
`cordova/www/index.html` が起点になり、Android の WebView がそれを読み込む。

---

## 環境・バージョン

| 項目 | バージョン | 役割 |
|---|---|---|
| Node.js | 20.15.1 | JS 実行環境。npm コマンドの基盤 |
| Vue | 3.x | UI フレームワーク。Composition API を使用 |
| Vite | 5.x | ビルドツール。開発サーバー + バンドラー |
| onsenui | 2.12.x | モバイル向け UI コンポーネント（CSS + JS） |
| vue-onsenui | 3.0.0 | Onsen UI の Vue 3 ラッパー |
| Cordova | （グローバルインストール） | Web アプリを Android/iOS アプリに変換 |

### Node.js バージョンの注意点

Node.js と各ツールには互換性がある。`npm create vite` の最新版（v8 系）は
Node.js 20.x に非対応のため Vite 5 を使用している。
バージョン起因のエラーが出たら `node -v` でまず確認する。

---

## ディレクトリ構成（全体）

```
cordova_vuejs/
└── 002/
    ├── vue/
    │   └── tarotapp/          ← Vue プロジェクトのルート
    │       ├── index.html     ← Vite のエントリ HTML
    │       ├── package.json
    │       ├── vite.config.js
    │       ├── operation.md   ← このファイル
    │       └── src/
    │           ├── main.js    ← Vue アプリの起動点
    │           ├── App.vue    ← メインコンポーネント（全ロジック）
    │           └── style.css  ← グローバルスタイル
    │
    └── cordova/               ← Cordova プロジェクトのルート
        ├── config.xml         ← アプリ設定（アイコン・権限・ID など）
        ├── package.json
        ├── keystore/
        │   └── tarotapp.keystore  ← 署名用キーストア
        ├── res/
        │   └── icon/android/
        │       └── ic_launcher.png  ← アプリアイコン
        ├── www/               ← Vue ビルド結果（dist/）をここにコピー
        │   ├── index.html
        │   └── assets/        ← JS・CSS・フォント等
        └── platforms/
            └── android/       ← cordova platform add android で生成
                └── app/build/outputs/apk/
                    ├── debug/app-debug.apk
                    └── release/app-release.apk
```

---

## Step 1: プロジェクト作成

```bash
mkdir -p cordova_vuejs/002/vue
cd cordova_vuejs/002/vue
npm create vite@latest tarotapp -- --template vue
cd tarotapp
npm install
```

### `npm create vite` の仕組み

`npm create vite` は `create-vite` というスキャフォールドツールを実行する短縮形。
`--template vue` を付けると Vue 3 + Composition API の雛形が生成される。
生成される主なファイル：

| ファイル | 内容 |
|---|---|
| `index.html` | アプリのエントリポイント。`<div id="app">` が Vue のマウント先 |
| `src/main.js` | `createApp(App).mount('#app')` で Vue を起動 |
| `src/App.vue` | ルートコンポーネント（最初は Hello World） |
| `vite.config.js` | Vite の設定ファイル |

### Vite とは

Webpack などの従来バンドラーと異なり、開発時は **ES Modules をそのままブラウザに渡す**（バンドルしない）。
そのためホットリロードが極めて高速。本番ビルド時は Rollup でバンドルする。

### Vite バージョンを 5 に変更

`npm create vite` の最新版（v8）は Node.js 20.15 に非対応のため、
`package.json` を手動で書き換えて Vite 5 を使用する。

```json
"devDependencies": {
  "@vitejs/plugin-vue": "^5.0.0",
  "vite": "^5.0.0"
}
```

```bash
npm install
```

---

## Step 2: Onsen UI のインストール

Cordova + モバイル向け UI フレームワークとして Onsen UI を導入。

```bash
npm install onsenui vue-onsenui
```

### Onsen UI とは

スマートフォン向けの UI コンポーネントライブラリ。
ボタン・ダイアログ・リストなどが iOS / Android のネイティブアプリっぽいデザインで揃っている。
Cordova と組み合わせて使うことを想定して作られている。

| パッケージ | 役割 |
|---|---|
| `onsenui` | CSS + ネイティブ JS の本体。フォントや `.dialog` などのクラスを提供 |
| `vue-onsenui` | Onsen UI を Vue コンポーネント（`v-ons-button` 等）として使えるラッパー |

### main.js への登録

```js
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

import VueOnsen from 'vue-onsenui'
import 'onsenui/css/onsenui.css'
import 'onsenui/css/onsen-css-components.css'

createApp(App).use(VueOnsen).mount('#app')
```

### `.use()` プラグイン登録の仕組み

Vue の `.use(plugin)` はプラグインをアプリ全体に登録する。
`VueOnsen` は内部で `v-ons-button` などのグローバルコンポーネントを登録している。
`.use()` を呼ばないと `<v-ons-button>` などのタグが「未定義コンポーネント」エラーになる。

CSS のインポートは Vue コンポーネント側ではなく `main.js` でやる理由は、
Onsen UI の CSS がグローバルに適用される必要があるため。

---

## Step 3: index.html の設定

Cordova / モバイル向けに `user-scalable=no` を設定（ピンチズーム無効化）。

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
```

### viewport meta タグの各パラメータ

| パラメータ | 意味 |
|---|---|
| `width=device-width` | 表示幅をデバイスの物理幅に合わせる。これがないと PC 用サイズで縮小表示される |
| `initial-scale=1.0` | 初期ズーム倍率を 1.0（等倍）にする |
| `user-scalable=no` | ピンチイン/アウトによるズームを禁止する |

アプリとしての UX を出すために `user-scalable=no` は必須。
ウェブサイトとしてのアクセシビリティ観点では推奨されないが、
Cordova アプリ（= ネイティブアプリの代替）では一般的な設定。

---

## Step 4: style.css の設定

### 重要なポイント

`body` に `overflow: hidden` を設定してはいけない。

Onsen UI の `v-ons-dialog` / `v-ons-modal` は内部の `portal` mixin によって
マウント時に自動的に `document.body` の直下に移動（teleport）される。
このとき `body { overflow: hidden }` が設定されていると、
ダイアログが画面下部にずれて表示されるバグが発生する。

`overflow: hidden` は `body` ではなく `#app` に設定する。

```css
html, body {
  width: 100%;
  height: 100%;
  background: #0e0e1a;
  color: #e0e0e0;
  /* overflow: hidden はここに書かない */
}

#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
```

### なぜ `height: 100%` を html / body / #app の全部に設定するのか

CSS の `height: 100%` は**親要素の高さを基準**にする相対値。
`html` に `height: 100%` がないと `body` の 100% が「コンテンツ高さ」になり、
画面いっぱいに広がらない。チェーンで全部に設定することで画面全体の高さを確保できる。

```
html (height: 100% → ビューポートの高さ)
  └── body (height: 100% → html の高さ = ビューポート)
        └── #app (height: 100% → body の高さ = ビューポート)
```

### overflow: hidden の役割

カレンダーのセルがはみ出したり、スクロールが発生しないよう `#app` で切る。
Onsen UI の dialog は body 直下に移動するため、この `overflow: hidden` の影響を受けない。

---

## Step 5: API データ取得

エンドポイント: `http://toyohide.work/BrainLog/api/tarothistory`
メソッド: POST

```js
const res = await fetch('http://toyohide.work/BrainLog/api/tarothistory', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
})
const json = await res.json()
tarotList.value = json.data || []
```

### fetch API と async/await

`fetch()` は非同期処理で、結果は `Promise` で返ってくる。
`await` を使うと Promise の完了を待ってから次の行に進む。
`await` を使う関数には `async` キーワードが必要。

```js
// await なしだと res は Promise オブジェクトになってしまう
const res = fetch(url)           // NG: res = Promise
const res = await fetch(url)     // OK: res = Response オブジェクト
```

### try-catch-finally の構造

```js
async function fetchTarotHistory() {
  loading.value = true   // ローディング開始
  error.value = null
  try {
    // 成功したときの処理
  } catch (e) {
    error.value = e.message   // エラー発生時
  } finally {
    loading.value = false     // 成功・失敗どちらでも必ず実行
  }
}
```

### ref() と .value

Vue 3 の Composition API では `ref()` でリアクティブな変数を作る。
JS コード内では `.value` でアクセスし、テンプレート内では `.value` 不要。

```js
const tarotList = ref([])
tarotList.value = json.data   // JS 内は .value が必要
```

```html
{{ tarotList.length }}   <!-- テンプレートでは .value 不要 -->
```

### onMounted の役割

`onMounted` はコンポーネントが DOM に描画された直後に実行されるライフサイクルフック。
API 取得などの「画面表示後に実行したい処理」はここに書く。

```js
onMounted(fetchTarotHistory)
// ↑ () => fetchTarotHistory() の省略形
```

### レスポンスの形式

```json
{
  "data": [
    {
      "year": "2021",
      "month": "09",
      "day": "12",
      "id": 54,
      "name": "Swords 4",
      "image": "swords04",
      "reverse": "1",
      "word": "動く / 急ぐ / 行動的 / 躍動的 / 外交的になる"
    }
  ]
}
```

- `image` フィールドを使って画像 URL を組み立てる
  - `http://toyohide.work/BrainLog/tarotcards/{image}.jpg`
- `reverse` が `"1"` のとき逆位置（画像を 180 度回転して表示）
- `year` / `month` / `day` は**文字列型**で来る（数値ではない）点に注意

---

## Step 6: カレンダー表示の実装

### 設計方針

- API から全データを一括取得してクライアント側で保持
- `tarotMap` computed で `"YYYY-MM-DD"` キーの O(1) ルックアップ辞書を作成
- `calendarCells` computed で 42 マス（6週 × 7日）の配列を生成
- 初期表示は API データの最新月

### computed とは

`computed` は依存する `ref` の値が変わったときだけ再計算されるキャッシュ付き計算値。
同じ値が変わらない限り何度アクセスしても再計算されない（= パフォーマンスが良い）。

```js
// ref が変わるたびに再計算される
const tarotMap = computed(() => { ... })
```

### tarotMap（O(1) ルックアップ）

配列のまま使うと「特定の日付のデータを探す」たびに全件ループ（O(n)）が発生する。
事前に `{ "2021-09-12": {...} }` のような辞書を作ると、
キー指定で即座に取り出せる（O(1)）。

```js
const tarotMap = computed(() => {
  const map = {}
  for (const item of tarotList.value) {
    const key = `${item.year}-${item.month.padStart(2, '0')}-${item.day.padStart(2, '0')}`
    map[key] = item
  }
  return map
})
```

`padStart(2, '0')` は文字列を指定の長さにゼロ埋めする。
`"9".padStart(2, '0')` → `"09"`。API の month/day が 1桁の場合があるため必要。

### calendarCells

```js
const calendarCells = computed(() => {
  const firstDay = new Date(y, m - 1, 1).getDay() // 月初の曜日 (0=日)
  const daysInMonth = new Date(y, m, 0).getDate()  // 月の日数

  return Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - firstDay + 1
    if (dayNum < 1 || dayNum > daysInMonth) return { day: null, tarot: null }
    const key = `${y}-${mm}-${dd}`
    return { day: dayNum, tarot: tarotMap.value[key] || null }
  })
})
```

#### なぜ 42 マスか

カレンダーは 7列（曜日）× 6行 = 42マス固定にする。
月によっては 5行で収まるが、6行固定にすることで高さが毎月変わらず安定する。

#### `new Date(y, m - 1, 1).getDay()` の仕組み

- `new Date(year, month, day)` の month は **0始まり**（1月 = 0）
- `.getDay()` は曜日を返す（0=日, 1=月, ..., 6=土）
- これで「月の1日が何曜日か」を取得できる

#### `new Date(y, m, 0).getDate()` の仕組み

- `day = 0` を指定すると「前月の最終日」を返す
- `new Date(2021, 9, 0)` → 9月の最終日 = 30
- これで月の日数を求められる（うるう年も自動対応）

### カレンダーグリッド CSS

画面全体をフルサイズで使うために `flex: 1` と `grid-template-rows: repeat(6, 1fr)` で
ナビ・ヘッダー以外の残り全高を均等 6 行に分割する。

```css
.app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative; /* ons-dialog の基準点 */
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: 3px;
  flex: 1;
  min-height: 0; /* flex 子要素の縮小を許可 */
}
```

#### `min-height: 0` が必要な理由

Flexbox の子要素はデフォルトで `min-height: auto`（= コンテンツ高さ）になっている。
これを `0` にしないと、`flex: 1` を指定しても子要素がコンテンツ高さ以下に縮まない。
Grid × Flex の組み合わせで高さが画面をはみ出すときはまずここを疑う。

---

## Step 7: 月ナビゲーション（境界制限付き）

データの最古月・最新月を computed で取得し、それを超えた月への遷移を禁止する。

```js
const oldestYM = computed(() => {
  if (!tarotList.value.length) return null
  const f = tarotList.value[0]
  return { year: parseInt(f.year), month: parseInt(f.month) }
})

const newestYM = computed(() => {
  if (!tarotList.value.length) return null
  const l = tarotList.value[tarotList.value.length - 1]
  return { year: parseInt(l.year), month: parseInt(l.month) }
})

const canGoPrev = computed(() => {
  if (!oldestYM.value) return false
  return currentYear.value > oldestYM.value.year ||
    (currentYear.value === oldestYM.value.year && currentMonth.value > oldestYM.value.month)
})
```

ボタンに `:disabled="!canGoPrev"` / `:disabled="!canGoNext"` を付けることで
最古月・最新月でそれぞれのボタンが無効化される。

ナビゲーションのレイアウトは `justify-content: space-between` で
＜ボタンを左端、＞ボタンを右端、月ラベルを中央に配置。

### parseInt() が必要な理由

API の `year` / `month` は文字列型で来る。
比較演算子 `>` / `<` は文字列比較と数値比較で結果が異なる場合がある。

```js
"9" > "10"   // true（文字列比較: "9" > "1"）
9 > 10       // false（数値比較: 正しい）
```

`parseInt()` で数値に変換してから比較することで正しく動く。

### 月の繰り上がり/繰り下がり処理

```js
function prevMonth() {
  if (!canGoPrev.value) return
  currentMonth.value === 1
    ? (currentYear.value--, currentMonth.value = 12)   // 1月 → 前年12月
    : currentMonth.value--
}

function nextMonth() {
  if (!canGoNext.value) return
  currentMonth.value === 12
    ? (currentYear.value++, currentMonth.value = 1)    // 12月 → 翌年1月
    : currentMonth.value++
}
```

---

## Step 8: カードの表示

### セル内の表示

タロットが引かれた日のセル内に、カード画像を表示。

```html
<div v-for="(cell, i) in calendarCells" :key="i" class="cell"
  :class="{
    empty: !cell.day,
    sun: cell.day && i % 7 === 0,
    sat: cell.day && i % 7 === 6,
    'has-tarot': cell.tarot,
  }"
  @click="cell.tarot && openDialog(cell.tarot)"
>
```

### v-for と :key

`v-for` でリストを描画するとき `:key` は必須。
Vue がどの要素が変化したかを特定するための識別子。
`:key` がないと再描画時に意図しない挙動が発生することがある。

### :class オブジェクト構文

`:class="{ クラス名: 条件 }"` で条件が `true` のときだけクラスを付与できる。
複数条件を同時に書ける。

```html
:class="{
  empty: !cell.day,      // cell.day が null/undefined のとき .empty を付与
  sun: i % 7 === 0,      // 日曜列（0, 7, 14...）に .sun を付与
  'has-tarot': cell.tarot  // タロットデータがある日に .has-tarot を付与
}"
```

### @click の短絡評価

```html
@click="cell.tarot && openDialog(cell.tarot)"
```

`&&` の左辺が falsy（null）の場合、右辺は評価されない。
タロットがない日はクリックしても `openDialog` が呼ばれない。

逆位置（`reverse === "1"`）のとき CSS で画像を 180 度回転。

```css
.tarot-img.reversed {
  transform: rotate(180deg);
}
```

---

## Step 9: ダイアログの実装

### Onsen UI ダイアログのハマりポイント

`v-ons-dialog` コンポーネントは内部の `portal` mixin によって
`document.body` の直下に自動移動する。
しかし vue-onsenui 3.0.0 では `:visible` prop の反映タイミングや
アニメーターによるインラインスタイル上書きの影響で、
`v-ons-page` を使わない構成だとダイアログが画面下部に表示されるバグがある。

### 解決策

`v-ons-dialog` コンポーネントは使わず、**Onsen UI の CSS クラス**
（`.dialog-mask` / `.dialog` / `.dialog-container`）をそのまま使い、
Vue の `<Teleport to="body">` で body 直下に配置する。

これにより：
- Onsen UI の `.dialog-mask`（`position: absolute; inset: 0`）がビューポート全体を覆う
- `.dialog`（`position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%)`）が画面中央に表示される
- Vue が DOM の配置を完全に管理するため位置ズレが発生しない

```html
<Teleport to="body">
  <div v-if="dialogVisible" class="dialog-mask" @click="closeDialog">
    <div class="dialog" @click.stop>
      <div class="dialog-container dialog-content">
        <div v-if="selectedTarot" class="dialog-inner">
          <!-- 日付、画像、カード名、正/逆位置バッジ、キーワード -->
        </div>
      </div>
    </div>
  </div>
</Teleport>
```

### Teleport とは

`<Teleport to="body">` はコンポーネントの DOM を別の場所（ここでは body 直下）に
レンダリングする Vue 3 の機能。
Vue のコンポーネントツリー上は元の場所にいるが、実際の DOM は `body` 直下に配置される。
ダイアログ・モーダル・ツールチップなど、z-index の管理が必要な UI に使う。

### イベント伝播と @click.stop

```html
<div class="dialog-mask" @click="closeDialog">   <!-- 背景タップで閉じる -->
  <div class="dialog" @click.stop>               <!-- カード部分のタップは伝播しない -->
```

`@click.stop` は `event.stopPropagation()` の Vue 修飾子。
カード部分をタップしたときに `dialog-mask` への `@click` が伝播しないようにする。
これがないとカード部分をタップしてもダイアログが閉じてしまう。

### ダイアログ内の表示内容

| 項目 | 内容 |
|---|---|
| 日付 | `year/month/day` |
| 画像 | `width: 50vw; max-width: 200px` / 逆位置は 180 度回転 |
| カード名 | `name` フィールド |
| 正/逆位置バッジ | `reverse === "1"` で「逆位置」（赤系）、それ以外「正位置」（緑系）|
| キーワード | `word` フィールド |

### ダイアログのサイズ（モバイル向け）

```css
.dialog-content {
  width: 90vw;       /* 画面幅の 90% */
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;  /* 縦に溢れたらスクロール */
}
```

`vw` / `vh` は**ビューポート幅/高さに対する割合**。
`90vw` = 画面幅の 90%。画面サイズが違う端末でも適切な幅になる。

---

## Step 10: getAllTarot API の追加と feel 表示

### API 追加

`tarothistory` と同時に `getAllTarot` も `Promise.all` で並列取得する。

```js
const [histRes, allRes] = await Promise.all([
  fetch('http://toyohide.work/BrainLog/api/tarothistory', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
  }),
  fetch('http://toyohide.work/BrainLog/api/getAllTarot', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
  }),
])
tarotList.value = histJson.data || []
allTarotList.value = allJson.data || []
```

### Promise.all とは

複数の非同期処理を**並列**で実行し、全部完了するのを待つ。
直列で書いた場合との比較：

```js
// 直列（合計 = API1の時間 + API2の時間）
const histRes = await fetch(url1)
const allRes  = await fetch(url2)

// 並列（合計 = 長い方のAPI時間のみ）
const [histRes, allRes] = await Promise.all([fetch(url1), fetch(url2)])
```

### allTarotMap computed

`getAllTarot` のレスポンスを `name` キーで引けるように変換する。

```js
const allTarotMap = computed(() => {
  const map = {}
  for (const item of allTarotList.value) {
    map[item.name] = { feel_j: item.feel_j, feel_r: item.feel_r }
  }
  return map
})
```

- `feel_j` = just（正位置）のフィール値
- `feel_r` = reverse（逆位置）のフィール値
- 値 `9` = ○（良い）、`1` = ×（悪い）

### カレンダーセルへの feel 表示

`tarothistory` の `name` と `allTarotMap` を突合し、`reverse` に応じて `feel_j` / `feel_r` を参照する。

```html
<div v-if="allTarotMap[cell.tarot.name]" class="cell-feel"
  :class="(cell.tarot.reverse === '1'
    ? allTarotMap[cell.tarot.name].feel_r
    : allTarotMap[cell.tarot.name].feel_j) == 9 ? 'feel-good' : 'feel-bad'">
  {{ (cell.tarot.reverse === '1'
    ? allTarotMap[cell.tarot.name].feel_r
    : allTarotMap[cell.tarot.name].feel_j) == 9 ? '○' : '×' }}
</div>
```

### `==` と `===` の違い

```js
feel_j == 9   // 型変換あり: "9" == 9 → true（文字列と数値を比較できる）
feel_j === 9  // 型変換なし: "9" === 9 → false
```

API の `feel_j` が文字列 `"9"` で来る場合があるため `==` を使っている。
厳密比較にするなら `parseInt(feel_j) === 9` とする。

### feel インジケーターの CSS

カード画像の右下に絶対配置で重ねる。

```css
.tarot-wrap {
  position: relative;   /* cell-feel の基準点 */
  overflow: visible;    /* セル外にはみ出す場合も .cell の overflow:hidden で制御 */
}

.cell-feel {
  position: absolute;
  right: 2px;
  bottom: 4px;
  font-size: 3.25rem;
  font-weight: bold;
  line-height: 1;
  text-shadow: 0 0 8px rgba(0, 0, 0, 1);
}
.cell-feel.feel-good { color: #80e080; -webkit-text-stroke: 2.5px #80e080; }
.cell-feel.feel-bad  { color: #e08080; font-size: 3.12rem; }
```

### `position: absolute` の基準点

`position: absolute` は「最も近い `position: relative` / `absolute` / `fixed` の祖先」を基準に配置される。
`.tarot-wrap` に `position: relative` を付けることで、
`.cell-feel` がセル全体ではなく `.tarot-wrap` を基準に配置される。

### カード画像が縮まない問題の修正

`max-height: 100%` だと画像が tarot-wrap の全高を使い切り、feel が `overflow: hidden` でクリップされる。
`flex: 1; min-height: 0` に変更して画像を縮ませ、feel が表示できるようにする。

```css
.tarot-img {
  flex: 1;
  min-height: 0;
  max-width: 100%;
  object-fit: contain;
  display: block;
}
```

### セル内カード名の削除

カード名（`cell-name`）は単語折り返しで表示が崩れるため削除。カード名はダイアログ内のみで表示する。

### cell-feel の z-index は設定しない

`z-index: 1` を設定すると、ダイアログを開いても ○× がダイアログの上に表示されてしまう。
`z-index` を削除することで Onsen UI の `.dialog-mask` / `.dialog` の高い z-index が優先される。

---

## Step 11: ダイアログ内への feel 表示

### テンプレート

ダイアログの画像に `position: relative` なラッパーを追加し、○× を絶対配置で重ねる。

```html
<div class="dialog-img-wrap">
  <div class="dialog-img-inner">
    <img :src="imageUrl(selectedTarot.image)" :alt="selectedTarot.name"
      class="dialog-img" :class="{ reversed: selectedTarot.reverse === '1' }" />
    <div v-if="allTarotMap[selectedTarot.name]" class="dialog-feel"
      :class="(selectedTarot.reverse === '1'
        ? allTarotMap[selectedTarot.name].feel_r
        : allTarotMap[selectedTarot.name].feel_j) == 9 ? 'feel-good' : 'feel-bad'">
      {{ (selectedTarot.reverse === '1'
        ? allTarotMap[selectedTarot.name].feel_r
        : allTarotMap[selectedTarot.name].feel_j) == 9 ? '○' : '×' }}
    </div>
  </div>
</div>
```

### CSS

```css
.dialog-img-inner {
  position: relative;
  display: inline-block;  /* 画像幅にぴったり合わせる */
}
.dialog-feel {
  position: absolute;
  right: 4px;
  bottom: 8px;
  font-size: 7.5rem;
  font-weight: normal;  /* 細め */
  line-height: 1;
  text-shadow: 0 0 10px rgba(0, 0, 0, 1);
}
.dialog-feel.feel-good { color: #80e080; -webkit-text-stroke: 4px #80e080; }
.dialog-feel.feel-bad  { color: #e08080; font-size: 9rem; }
```

- セルの `cell-feel`（3.25rem）に対してダイアログは 7.5rem（× は 9rem）
- `font-weight: normal` + `-webkit-text-stroke: 4px` で適度な太さを確保
- × のサイズは ○ の 1.2 倍（7.5 × 1.2 = 9rem）

### `display: inline-block` を使う理由

`display: block` にすると要素が親の横幅いっぱいに広がる。
`inline-block` にすると**コンテンツ（画像）の幅にぴったり合わせた**サイズになる。
`.dialog-img-inner` を `inline-block` にすることで、
`.dialog-feel` の `right: 4px / bottom: 8px` が画像の右下を基準にした配置になる。

### `-webkit-text-stroke` とは

テキストに輪郭線（ストローク）を付ける CSS プロパティ。
`-webkit-text-stroke: 4px #80e080` で緑色の 4px ストロークを付与。
標準プロパティではなく WebKit 独自拡張だが Android / iOS の WebView では使用可能。

---

## 開発サーバーの起動

```bash
cd cordova_vuejs/002/vue/tarotapp
npm run dev
```

ブラウザで `http://localhost:5174` を開く（5173 が他で使用中の場合は 5174 になる）。

### 開発サーバーとビルドの違い

| 操作 | コマンド | 用途 |
|---|---|---|
| 開発サーバー起動 | `npm run dev` | ブラウザで即確認。ファイル変更が即反映 |
| 本番ビルド | `npm run build` | `dist/` に最適化済みファイルを出力。Cordova に使う |
| プレビュー | `npm run preview` | ビルド結果をローカルで確認（Cordova に載せる前の最終確認に便利） |

---

## Step 12: Cordova Android ビルド

### Cordova の仕組み

Cordova は Web アプリ（HTML/JS/CSS）を Android の `WebView`（ブラウザ内蔵コンポーネント）で表示するシェルを生成する。
`www/` ディレクトリの内容が `file:///android_asset/www/index.html` として読み込まれる。

```
Android アプリ起動
  └── WebView が起動
        └── file:///android_asset/www/index.html を読み込む
              └── Vue アプリが動く
```

### `file://` プロトコルへの対応

通常の Web サーバー（`http://`）で動くアプリをそのまま Cordova に載せると、
JS / CSS のパスが絶対パス（`/assets/index.js`）になっていて読み込めない。
`vite.config.js` の `base: './'` で相対パスにすることで `file://` でも動く。

```js
// vite.config.js
export default defineConfig({
  plugins: [vue()],
  base: './',   // ← これが必須
})
```

### 事前設定（完了済み）

| ファイル | 設定内容 | 理由 |
|---|---|---|
| `vite.config.js` | `base: './'` | `file://` プロトコルで相対パス解決するため |
| `config.xml` | `<access origin="*" />` | 外部 API（toyohide.work）への HTTP 通信を許可 |
| `config.xml` | `AndroidInsecureFileModeEnabled` | `file://` から外部リソースへのアクセスを許可 |
| `AndroidManifest.xml` | `usesCleartextTraffic="true"` | Android 9 以降で HTTP（非 HTTPS）通信を許可 |

### Vue アプリのビルドと www へのコピー

```bash
cd cordova_vuejs/002/vue/tarotapp
npm run build
cp -r dist/* ../../cordova/www/
```

`dist/` に生成されるファイル：

| ファイル | 内容 |
|---|---|
| `index.html` | エントリポイント。JS/CSS を読み込む |
| `assets/index-xxxxx.js` | Vue アプリ全体がバンドルされた JS |
| `assets/index-xxxxx.css` | バンドルされた CSS |
| `assets/*.woff2` など | Onsen UI のアイコンフォント |

ハッシュ（`xxxxx` 部分）はビルドのたびに変わる。
これはブラウザキャッシュを無効化するための仕組み（コンテンツハッシュ）。

---

## Step 13: エミュレータでの動作確認

```bash
cd cordova_vuejs/002/cordova
npx cordova emulate android
```

エミュレータが起動していれば自動でビルド・インストール・起動まで行われる。

### 実行時の流れ

1. Gradle（Android のビルドツール）が Java/Kotlin コードをコンパイル
2. `www/` の内容が APK に梱包される
3. ADB（Android Debug Bridge）経由でエミュレータにインストール
4. アプリが自動起動

### `cordova emulate` と `cordova run` の違い

| コマンド | 対象 |
|---|---|
| `cordova emulate android` | 仮想デバイス（エミュレータ）に転送 |
| `cordova run android` | 接続中の実機に転送（エミュレータも対象になる） |

### エミュレータが起動していない場合

Android Studio → Device Manager からエミュレータを事前に起動しておく必要がある。
`adb devices` でデバイスの接続状況を確認できる。

```bash
adb devices
# List of devices attached
# emulator-5554  device   ← これが出ていれば OK
```

---

## Step 14: アプリアイコンの設定

### アイコン画像の配置

```bash
mkdir -p cordova_vuejs/002/cordova/res/icon/android
cp <元画像パス>/ic_launcher.png cordova_vuejs/002/cordova/res/icon/android/ic_launcher.png
```

### config.xml への追記

`<platform name="android">` ブロック内に追加：

```xml
<platform name="android">
    <icon src="res/icon/android/ic_launcher.png" />
    <preference name="AndroidInsecureFileModeEnabled" value="true" />
    ...
</platform>
```

### アイコン画像の推奨サイズ

Cordova は 1 枚の画像から各 DPI 用のアイコンを自動生成する。
元画像は 1024×1024px 以上の PNG が推奨。
DPI 別に個別指定する場合は以下のサイズが必要：

| DPI | サイズ | ディレクトリ |
|---|---|---|
| mdpi | 48×48 | mipmap-mdpi |
| hdpi | 72×72 | mipmap-hdpi |
| xhdpi | 96×96 | mipmap-xhdpi |
| xxhdpi | 144×144 | mipmap-xxhdpi |
| xxxhdpi | 192×192 | mipmap-xxxhdpi |

### mipmap とは

Android はアイコンを `mipmap-xxxhdpi` などのディレクトリに解像度別に保持している。
端末の DPI に応じて適切なサイズのアイコンを選んで表示する仕組み。
Cordova の `config.xml` で 1 枚指定すれば、ビルド時に自動で各 DPI 用に変換してくれる。

---

## Step 15: キーストアの作成とリリース APK のビルド

### 署名とは何か

Android アプリはインストール前に**開発者の署名**が必要。
署名することで「このアプリは確かに自分が作った」ことを証明する。
署名なしアプリはインストールできない（Google Play もキーストアが必須）。

デバッグビルド（`cordova emulate`）は Android が自動生成したデバッグキーで署名される。
リリースビルドは自前のキーストアで署名する必要がある。

### キーストアとは

秘密鍵と証明書を格納したファイル（`.keystore` / `.jks`）。
一度作ったキーストアは **絶対に失くしてはいけない**。
Google Play に公開後にキーストアを無くすと、同じアプリ ID でアップデートが出せなくなる。

### キーストア作成

```bash
keytool -genkey -v \
  -keystore cordova_vuejs/002/cordova/keystore/tarotapp.keystore \
  -alias tarotapp \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=toyodahideyuki, OU=dev, O=dev, L=Tokyo, ST=Tokyo, C=JP" \
  -storepass tarotapp123 \
  -keypass tarotapp123
```

| オプション | 意味 |
|---|---|
| `-keystore` | キーストアファイルの保存先 |
| `-alias` | キーの別名（1つのキーストアに複数の鍵を入れるときに区別する） |
| `-keyalg RSA` | 暗号アルゴリズム。RSA が標準 |
| `-keysize 2048` | 鍵長。2048bit が推奨最低値 |
| `-validity 10000` | 有効期限（日数）。10000日 ≒ 27年 |
| `-dname` | 証明書の識別名（CN=名前, O=組織, C=国コード） |
| `-storepass` | キーストアファイルのパスワード |
| `-keypass` | 個別の鍵のパスワード |

本プロジェクトのキーストア情報：

| 項目 | 値 |
|---|---|
| 保存先 | `cordova/keystore/tarotapp.keystore` |
| エイリアス | `tarotapp` |
| パスワード | `tarotapp123` |
| 有効期限 | 10,000日（約27年） |

### デバッグビルド vs リリースビルド

| 項目 | デバッグ | リリース |
|---|---|---|
| コマンド | `cordova build android` | `cordova build android --release` |
| 署名 | Android の自動デバッグキー | 自前のキーストア |
| 最適化 | なし | コード圧縮・難読化あり |
| ファイルサイズ | 大きめ | 小さめ |
| 用途 | 動作確認・開発中 | 配布・Play Store |

### APK と AAB の違い

| 形式 | 特徴 | 用途 |
|---|---|---|
| APK | そのままインストールできる | 直接配布・サイドロード |
| AAB | Google が端末ごとに最適な APK を生成する | Google Play Store 経由での配布 |

Cordova は `--packageType=apk` で APK、デフォルト（省略時）で AAB を生成する。

### リリース APK ビルド

```bash
cd cordova_vuejs/002/cordova
npx cordova build android --release -- \
  --keystore=keystore/tarotapp.keystore \
  --alias=tarotapp \
  --storePassword=tarotapp123 \
  --password=tarotapp123 \
  --packageType=apk
```

### 出力ファイル

| 種類 | パス |
|---|---|
| リリース APK | `platforms/android/app/build/outputs/apk/release/app-release.apk` |
| リリース AAB | `platforms/android/app/build/outputs/bundle/release/app-release.aab` |
| デバッグ APK | `platforms/android/app/build/outputs/apk/debug/app-debug.apk` |

フルパス（リリース APK）：
```
/Users/toyodahideyuki/Desktop/HIDEYUKI/MY_STUDY/cordova_vuejs/002/cordova/platforms/android/app/build/outputs/apk/release/app-release.apk
```

---

## Vue 変更後の再ビルド手順（次回以降）

Vue のコードを修正したあと Cordova に反映するまでの手順：

```bash
# 1. Vue アプリをビルド
cd /Users/toyodahideyuki/Desktop/HIDEYUKI/MY_STUDY/cordova_vuejs/002/vue/tarotapp
npm run build

# 2. www にコピー
cp -r dist/* ../../cordova/www/

# 3a. エミュレータで確認
cd ../../cordova
npx cordova emulate android

# 3b. またはリリース APK をビルド
npx cordova build android --release -- \
  --keystore=keystore/tarotapp.keystore \
  --alias=tarotapp \
  --storePassword=tarotapp123 \
  --password=tarotapp123 \
  --packageType=apk
```

---

## トラブルシューティング

### エミュレータが見つからない

```
Error: No emulator images (avds) found.
```

→ Android Studio の Device Manager でエミュレータを作成・起動してから再実行。

### HTTP 通信がブロックされる

Android 9 以降はデフォルトで HTTP 通信が禁止されている。

→ `config.xml` に以下が設定されているか確認：

```xml
<edit-config file="app/src/main/AndroidManifest.xml"
             mode="merge" target="/manifest/application">
    <application android:usesCleartextTraffic="true" />
</edit-config>
```

### 画面が真っ白になる

`file://` プロトコルで JS/CSS が読み込めていない可能性がある。

→ `vite.config.js` に `base: './'` があるか確認。
→ `dist/` を `www/` にコピーした後、`www/index.html` の `src` / `href` が `./assets/...` の相対パスになっているか確認。

### ビルドエラー: JAVA_HOME が見つからない

→ Android Studio インストール時に JDK も一緒にインストールされる。
環境変数 `JAVA_HOME` が設定されているか確認。

```bash
echo $JAVA_HOME
# /Library/Java/JavaVirtualMachines/jdk-XX.X.X.jdk/Contents/Home
```

### アイコンが変わらない

→ エミュレータのランチャーをスワイプして更新するか、アプリをアンインストールして再インストールする。
アプリのアイコンはキャッシュされることがある。

### `cordova build` で Gradle のバージョン警告

```
Deprecated Gradle features were used in this build, making it incompatible with Gradle 9.0.
```

→ 現状では無害な警告。ビルド自体は成功する。
Cordova 側が Gradle 9.0 対応版にアップデートされるまで無視で OK。
