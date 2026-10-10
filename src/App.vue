<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Fingerboard from './components/Fingerboard.vue'
import { DEFAULT_TUNING_ID, TUNINGS, getTuning } from './data/tunings'
import { reedEngine } from './audio/ReedEngine'

type Bellows = 'push' | 'pull'

const STORAGE_KEYS = {
  tuning: 'harmonica:tuningId',
  bellows: 'harmonica:bellows',
  tremolo: 'harmonica:tremoloCents',
} as const

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore (private browsing, storage disabled, ...)
  }
}

const tuningId = ref(readStored(STORAGE_KEYS.tuning) ?? DEFAULT_TUNING_ID)
const tuning = computed(() => getTuning(tuningId.value))

// `baseBellows` is the sticky direction set by the on-screen toggle or the
// Space key. Holding Shift temporarily forces Zug (pull), like squeezing the
// bellows open without changing the sticky setting underneath.
const baseBellows = ref<Bellows>((readStored(STORAGE_KEYS.bellows) as Bellows | null) ?? 'push')
const shiftHeld = ref(false)
const bellows = computed<Bellows>(() => (shiftHeld.value ? 'pull' : baseBellows.value))

const tremoloCents = ref(Number(readStored(STORAGE_KEYS.tremolo) ?? '9'))
reedEngine.tremoloCents = tremoloCents.value

watch(tuningId, (id) => writeStored(STORAGE_KEYS.tuning, id))
watch(baseBellows, (value) => writeStored(STORAGE_KEYS.bellows, value))
watch(tremoloCents, (value) => {
  reedEngine.tremoloCents = value
  writeStored(STORAGE_KEYS.tremolo, String(value))
})

function toggleBellows(): void {
  baseBellows.value = baseBellows.value === 'push' ? 'pull' : 'push'
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || target.isContentEditable
}

function onKeyDown(event: KeyboardEvent): void {
  if (isTypingTarget(event.target)) return
  if (event.code === 'Space') {
    event.preventDefault()
    if (!event.repeat) {
      reedEngine.ensureStarted()
      toggleBellows()
    }
  } else if (event.key === 'Shift') {
    reedEngine.ensureStarted()
    shiftHeld.value = true
  }
}

function onKeyUp(event: KeyboardEvent): void {
  if (event.key === 'Shift') {
    shiftHeld.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})
</script>

<template>
  <div class="app">
    <header class="toolbar">
      <span class="brand">Steirische Harmonika</span>

      <label class="control">
        <span class="control-label">Stimmung</span>
        <select v-model="tuningId" class="tuning-select">
          <option v-for="t in TUNINGS" :key="t.id" :value="t.id">{{ t.label }}</option>
        </select>
      </label>

      <label class="control">
        <span class="control-label">Tremolo</span>
        <input v-model.number="tremoloCents" type="range" min="0" max="18" step="1" class="tremolo-slider" />
      </label>

      <div class="control bellows-control" role="group" aria-label="Bellows direction">
        <button
          type="button"
          class="bellows-button"
          :class="{ active: bellows === 'push' }"
          @click="baseBellows = 'push'"
        >
          Druck
        </button>
        <button
          type="button"
          class="bellows-button"
          :class="{ active: bellows === 'pull' }"
          @click="baseBellows = 'pull'"
        >
          Zug
        </button>
        <span class="bellows-hint">Space toggles · hold Shift for Zug</span>
      </div>
    </header>

    <main class="stage">
      <Fingerboard :tuning-offset="tuning.semitoneOffset" :bellows="bellows" />
    </main>
  </div>
</template>
