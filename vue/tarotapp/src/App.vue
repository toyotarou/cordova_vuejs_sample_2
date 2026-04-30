<script setup>
import { ref, computed, onMounted } from 'vue'

const tarotList = ref([])
const allTarotList = ref([])
const loading = ref(false)
const error = ref(null)

const currentYear = ref(0)
const currentMonth = ref(0)

const dialogVisible = ref(false)
const selectedTarot = ref(null)

async function fetchTarotHistory() {
  loading.value = true
  error.value = null
  try {
    const [histRes, allRes] = await Promise.all([
      fetch('http://toyohide.work/BrainLog/api/tarothistory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
      fetch('http://toyohide.work/BrainLog/api/getAllTarot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    ])
    const histJson = await histRes.json()
    const allJson = await allRes.json()

    tarotList.value = histJson.data || []
    allTarotList.value = allJson.data || []

    if (tarotList.value.length > 0) {
      const last = tarotList.value[tarotList.value.length - 1]
      currentYear.value = parseInt(last.year)
      currentMonth.value = parseInt(last.month)
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(fetchTarotHistory)

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

// name → { feel_j, feel_r } の辞書
const allTarotMap = computed(() => {
  const map = {}
  for (const item of allTarotList.value) {
    map[item.name] = { feel_j: item.feel_j, feel_r: item.feel_r }
  }
  return map
})

const tarotMap = computed(() => {
  const map = {}
  for (const item of tarotList.value) {
    const key = `${item.year}-${item.month.padStart(2, '0')}-${item.day.padStart(2, '0')}`
    map[key] = item
  }
  return map
})

const calendarCells = computed(() => {
  const y = currentYear.value
  const m = currentMonth.value
  if (!y || !m) return []
  const firstDay = new Date(y, m - 1, 1).getDay()
  const daysInMonth = new Date(y, m, 0).getDate()
  return Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - firstDay + 1
    if (dayNum < 1 || dayNum > daysInMonth) return { day: null, tarot: null }
    const mm = String(m).padStart(2, '0')
    const dd = String(dayNum).padStart(2, '0')
    const key = `${y}-${mm}-${dd}`
    return { day: dayNum, tarot: tarotMap.value[key] || null }
  })
})

const canGoPrev = computed(() => {
  if (!oldestYM.value) return false
  return currentYear.value > oldestYM.value.year ||
    (currentYear.value === oldestYM.value.year && currentMonth.value > oldestYM.value.month)
})

const canGoNext = computed(() => {
  if (!newestYM.value) return false
  return currentYear.value < newestYM.value.year ||
    (currentYear.value === newestYM.value.year && currentMonth.value < newestYM.value.month)
})

function prevMonth() {
  if (!canGoPrev.value) return
  currentMonth.value === 1 ? (currentYear.value--, currentMonth.value = 12) : currentMonth.value--
}

function nextMonth() {
  if (!canGoNext.value) return
  currentMonth.value === 12 ? (currentYear.value++, currentMonth.value = 1) : currentMonth.value++
}

function openDialog(tarot) {
  selectedTarot.value = tarot
  dialogVisible.value = true
}

function closeDialog() {
  dialogVisible.value = false
}

function imageUrl(image) {
  return `http://toyohide.work/BrainLog/tarotcards/${image}.jpg`
}

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
</script>

<template>
  <div class="app">
    <div v-if="loading" class="status">Loading...</div>
    <div v-else-if="error" class="status error">Error: {{ error }}</div>

    <template v-else>
      <div class="nav">
        <button :disabled="!canGoPrev" @click="prevMonth" class="nav-btn">＜</button>
        <span class="nav-label">{{ currentYear }} / {{ String(currentMonth).padStart(2, '0') }}</span>
        <button :disabled="!canGoNext" @click="nextMonth" class="nav-btn">＞</button>
      </div>

      <div class="calendar-header">
        <div v-for="(wd, i) in weekdays" :key="wd" class="weekday"
          :class="{ sun: i === 0, sat: i === 6 }">{{ wd }}</div>
      </div>

      <div class="calendar-grid">
        <div v-for="(cell, i) in calendarCells" :key="i" class="cell"
          :class="{
            empty: !cell.day,
            sun: cell.day && i % 7 === 0,
            sat: cell.day && i % 7 === 6,
            'has-tarot': cell.tarot,
          }"
          @click="cell.tarot && openDialog(cell.tarot)"
        >
          <template v-if="cell.day">
            <div class="day-num">{{ cell.day }}</div>
            <div v-if="cell.tarot" class="tarot-wrap">
              <img :src="imageUrl(cell.tarot.image)" :alt="cell.tarot.name"
                class="tarot-img" :class="{ reversed: cell.tarot.reverse === '1' }" />
              <div v-if="allTarotMap[cell.tarot.name]" class="cell-feel"
                :class="(cell.tarot.reverse === '1' ? allTarotMap[cell.tarot.name].feel_r : allTarotMap[cell.tarot.name].feel_j) == 9 ? 'feel-good' : 'feel-bad'">
                {{ (cell.tarot.reverse === '1' ? allTarotMap[cell.tarot.name].feel_r : allTarotMap[cell.tarot.name].feel_j) == 9 ? '○' : '×' }}
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- Onsen UI の .dialog-mask / .dialog クラスを使い、Teleport で body 直下に配置 -->
    <Teleport to="body">
      <div v-if="dialogVisible" class="dialog-mask" @click="closeDialog">
        <div class="dialog" @click.stop>
          <div class="dialog-container dialog-content">
            <div v-if="selectedTarot" class="dialog-inner">
              <div class="dialog-date">
                {{ selectedTarot.year }}/{{ selectedTarot.month }}/{{ selectedTarot.day }}
              </div>
              <div class="dialog-img-wrap">
                <div class="dialog-img-inner">
                  <img :src="imageUrl(selectedTarot.image)" :alt="selectedTarot.name"
                    class="dialog-img" :class="{ reversed: selectedTarot.reverse === '1' }" />
                  <div v-if="allTarotMap[selectedTarot.name]" class="dialog-feel"
                    :class="(selectedTarot.reverse === '1' ? allTarotMap[selectedTarot.name].feel_r : allTarotMap[selectedTarot.name].feel_j) == 9 ? 'feel-good' : 'feel-bad'">
                    {{ (selectedTarot.reverse === '1' ? allTarotMap[selectedTarot.name].feel_r : allTarotMap[selectedTarot.name].feel_j) == 9 ? '○' : '×' }}
                  </div>
                </div>
              </div>
              <div class="dialog-name">{{ selectedTarot.name }}</div>
              <div class="dialog-badge-row">
                <span class="dialog-badge" :class="selectedTarot.reverse === '1' ? 'reverse' : 'normal'">
                  {{ selectedTarot.reverse === '1' ? '逆位置' : '正位置' }}
                </span>
              </div>
              <div class="dialog-word">{{ selectedTarot.word }}</div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 6px;
  font-family: sans-serif;
  background: #0e0e1a;
  color: #e0e0e0;
  /* ons-dialog (position:absolute) の基準点をここに固定する */
  position: relative;
}

.status {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #aaa;
}
.status.error { color: #f88; }

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 6px;
  flex-shrink: 0;
}
.nav-label {
  font-size: 1rem;
  font-weight: bold;
  color: #e0e0e0;
  min-width: 110px;
  text-align: center;
}
.nav-btn {
  background: #2a2a2a;
  border: 1px solid #555;
  color: #ccc;
  font-size: 0.95rem;
  padding: 5px 14px;
  border-radius: 6px;
  cursor: pointer;
}
.nav-btn:hover:not(:disabled) { background: #3a3a3a; color: #fff; }
.nav-btn:disabled { opacity: 0.25; cursor: default; }

.calendar-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  flex-shrink: 0;
  border-bottom: 1px solid #444;
  padding-bottom: 3px;
  margin-bottom: 3px;
}
.weekday {
  text-align: center;
  font-size: 0.7rem;
  padding: 3px 0;
  color: #aaa;
  font-weight: bold;
}
.weekday.sun { color: #f07070; }
.weekday.sat { color: #7099f0; }

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: 3px;
  flex: 1;
  min-height: 0;
}
.cell {
  background: #1a1a1a;
  border: 1px solid #3a3a3a;
  border-radius: 4px;
  padding: 3px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cell.empty { background: #111; border-color: #222; }
.cell.has-tarot { background: #1e1e1e; border-color: #555; cursor: pointer; }
.cell.has-tarot:active { background: #2a2a2a; }

.day-num {
  font-size: 0.68rem;
  font-weight: bold;
  color: #aaa;
  flex-shrink: 0;
  line-height: 1;
  margin-bottom: 2px;
}
.cell.sun .day-num { color: #f07070; }
.cell.sat .day-num { color: #7099f0; }

.tarot-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  overflow: visible;
  position: relative;
}
.tarot-img {
  flex: 1;
  min-height: 0;
  max-width: 100%;
  object-fit: contain;
  display: block;
  border-radius: 2px;
}
.tarot-img.reversed { transform: rotate(180deg); }

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

/* Onsen UI .dialog-mask の背景を暗くする */
:global(.dialog-mask) {
  background: rgba(0, 0, 0, 0.65) !important;
}

/* ダイアログ内 */
.dialog-content {
  background: #1a1a2a;
  color: #e0e0e0;
  padding: 24px 20px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 90vw;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
}
.dialog-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  width: 100%;
}
.dialog-date { font-size: 0.9rem; color: #aaa; align-self: flex-start; }
.dialog-img-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  align-self: center;
}
.dialog-img-wrap img {
  width: 50vw;
  max-width: 200px;
  aspect-ratio: 2 / 3;
  object-fit: contain;
  border-radius: 6px;
  display: block;
}
.dialog-img.reversed { transform: rotate(180deg); }
.dialog-img-inner {
  position: relative;
  display: inline-block;
}
.dialog-feel {
  position: absolute;
  right: 4px;
  bottom: 8px;
  font-size: 7.5rem;
  font-weight: normal;
  line-height: 1;
  text-shadow: 0 0 10px rgba(0, 0, 0, 1);
}
.dialog-feel.feel-good { color: #80e080; -webkit-text-stroke: 4px #80e080; }
.dialog-feel.feel-bad  { color: #e08080; font-size: 9rem; }
.dialog-name { font-size: 1.2rem; font-weight: bold; color: #fff; text-align: center; }
.dialog-badge-row { display: flex; justify-content: center; }
.dialog-badge { font-size: 0.85rem; padding: 4px 16px; border-radius: 12px; }
.dialog-badge.normal { background: #2a4a2a; color: #80e080; }
.dialog-badge.reverse { background: #4a2a2a; color: #e08080; }
.dialog-word { font-size: 0.95rem; color: #ccc; text-align: center; line-height: 1.7; }
</style>
