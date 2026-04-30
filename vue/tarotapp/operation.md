# Tarot App 開発ログ

Vue.js + Vite + Onsen UI を使ったタロット履歴カレンダーアプリの作成記録。
最終的には Cordova で Android アプリとしてビルドする想定。

---

## 環境・バージョン

| 項目 | バージョン |
|---|---|
| Node.js | 20.15.1 |
| Vue | 3.x |
| Vite | 5.x |
| onsenui | 2.12.x |
| vue-onsenui | 3.0.0 |

---

## ディレクトリ構成

```
cordova_vuejs/
└── 002/
    └── vue/
        └── tarotapp/
            ├── index.html
            ├── package.json
            ├── vite.config.js
            └── src/
                ├── main.js
                ├── App.vue
                └── style.css
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

### Vite バージョンを 5 に変更

`npm create vite` の最新版 (v8) は Node.js 20.15 に非対応のため、`package.json` を手動で書き換えて Vite 5 を使用する。

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

---

## Step 3: index.html の設定

Cordova / モバイル向けに `user-scalable=no` を設定（ピンチズーム無効化）。

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
```

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

---

## Step 6: カレンダー表示の実装

### 設計方針

- API から全データを一括取得してクライアント側で保持
- `tarotMap` computed で `"YYYY-MM-DD"` キーの O(1) ルックアップ辞書を作成
- `calendarCells` computed で 42 マス（6週 × 7日）の配列を生成
- 初期表示は API データの最新月

### tarotMap

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

---

## Step 7: 月ナビゲーション（境界制限付き）

データの最古月・最新月を computed で取得し、それを超えた月への遷移を禁止する。

```js
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

---

## Step 8: カードの表示

### セル内の表示

タロットが引かれた日のセル内に、カード名と画像を縦並びで表示。

```html
<div v-if="cell.tarot" class="tarot-wrap">
  <div class="cell-name">{{ cell.tarot.name }}</div>
  <img :src="imageUrl(cell.tarot.image)" class="tarot-img"
    :class="{ reversed: cell.tarot.reverse === '1' }" />
</div>
```

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

背景タップで閉じる（`.dialog-mask` の `@click="closeDialog"`）、
カード部分タップは `@click.stop` で伝播を止める。

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
  font-size: 1.3rem;
  font-weight: bold;
  line-height: 1;
  z-index: 1;
  text-shadow: 0 0 8px rgba(0, 0, 0, 1);
}
.cell-feel.feel-good { color: #80e080; -webkit-text-stroke: 2px #80e080; } /* ○ を太く */
.cell-feel.feel-bad  { color: #e08080; font-size: 1.56rem; }               /* × は 1.2倍 */
```

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
  display: inline-block;
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

- セルの `cell-feel`（1.3rem）に対してダイアログは 7.5rem（× は 9rem）
- `font-weight: normal` + `-webkit-text-stroke: 4px` で適度な太さを確保
- × のサイズは ○ の 1.2 倍（7.5 × 1.2 = 9rem）

---

## 開発サーバーの起動

```bash
cd cordova_vuejs/002/vue/tarotapp
npm run dev
```

ブラウザで `http://localhost:5174` を開く（5173 が他で使用中の場合は 5174 になる）。

---

## Step 12: Cordova Android ビルド

### 事前設定（完了済み）

| 項目 | 内容 |
|---|---|
| `vite.config.js` | `base: './'` を追加（`file://` プロトコル対応） |
| `config.xml` | `<access origin="*" />` を追加 |
| `config.xml` | `AndroidInsecureFileModeEnabled` を追加 |
| `AndroidManifest.xml` | `android:usesCleartextTraffic="true"` を追加（HTTP API 許可） |

### Vue アプリのビルドと www へのコピー

```bash
cd cordova_vuejs/002/vue/tarotapp
npm run build
cp -r dist/* ../../cordova/www/
```

---

## Step 13: エミュレータでの動作確認

```bash
cd cordova_vuejs/002/cordova
npx cordova emulate android
```

エミュレータが起動していれば自動でビルド・インストール・起動まで行われる。

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
<icon src="res/icon/android/ic_launcher.png" />
```

---

## Step 15: キーストアの作成とリリース APK のビルド

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

| 項目 | 値 |
|---|---|
| 保存先 | `cordova/keystore/tarotapp.keystore` |
| エイリアス | `tarotapp` |
| パスワード | `tarotapp123` |
| 有効期限 | 10,000日（約27年） |

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

```
cordova_vuejs/002/cordova/platforms/android/app/build/outputs/apk/release/app-release.apk
```

フルパス：
```
/Users/toyodahideyuki/Desktop/HIDEYUKI/MY_STUDY/cordova_vuejs/002/cordova/platforms/android/app/build/outputs/apk/release/app-release.apk
```
