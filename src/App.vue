<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Fingerboard from './components/Fingerboard.vue'
import { DEFAULT_TUNING_ID, TUNINGS, getTuning } from './data/tunings'
import type { Button } from './data/layout'
import { reedEngine } from './audio/ReedEngine'
import { applyKeyboardLayout, buttonForCode } from './input/keyboardMap'
import { holdButton, releaseButton, releaseSourcesWithPrefix } from './input/holds'

type Bellows = 'push' | 'pull'

const STORAGE_KEYS = {
  tuning: 'harmonica:tuningId',
  bellows: 'harmonica:bellows',
  tone: 'harmonica:tremoloCents',
} as const

const TONE_MIN = 0
const TONE_MAX = 18
const TONE_DEFAULT = 9

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

function readTuningId(): string {
  const stored = readStored(STORAGE_KEYS.tuning)
  if (stored && TUNINGS.some((entry) => entry.id === stored)) return stored
  return DEFAULT_TUNING_ID
}

function readBellows(): Bellows {
  return readStored(STORAGE_KEYS.bellows) === 'pull' ? 'pull' : 'push'
}

function clampTone(value: number): number {
  if (!Number.isFinite(value)) return TONE_DEFAULT
  return Math.min(TONE_MAX, Math.max(TONE_MIN, Math.round(value)))
}

function readTone(): number {
  const stored = readStored(STORAGE_KEYS.tone)
  if (stored === null) return TONE_DEFAULT
  return clampTone(Number(stored))
}

const tuningId = ref(readTuningId())
const tuning = computed(() => getTuning(tuningId.value))

// `baseBellows` is the sticky direction set by the on-screen toggle. Holding
// Space or Shift temporarily forces Zug (pull) without changing that setting.
const baseBellows = ref<Bellows>(readBellows())
const shiftHeld = ref(false)
const spaceHeld = ref(false)
const bellows = computed<Bellows>(() => (shiftHeld.value || spaceHeld.value ? 'pull' : baseBellows.value))

const tremoloCents = ref(readTone())
reedEngine.tremoloCents = tremoloCents.value

const soundEl = ref<HTMLElement | null>(null)
let focusFrame = 0

function focusSound(): void {
  const el = soundEl.value
  if (!el || document.activeElement === el) return
  el.focus({ preventScroll: true })
}

function scheduleFocusSound(): void {
  cancelAnimationFrame(focusFrame)
  focusFrame = requestAnimationFrame(() => focusSound())
}

/** Tuning menu and tone slider need focus while a pointer is using them. */
function isSettingsField(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest('select, input, textarea')) return true
  const label = target.closest('label')
  return Boolean(label?.querySelector('select, input, textarea'))
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target.tagName === 'TEXTAREA') return true
  if (target.tagName !== 'INPUT') return false
  return (target as HTMLInputElement).type !== 'range'
}

function onPointerDownCapture(event: PointerEvent): void {
  if (isSettingsField(event.target)) return
  scheduleFocusSound()
}

watch(tuningId, (id) => {
  if (!TUNINGS.some((entry) => entry.id === id)) {
    tuningId.value = DEFAULT_TUNING_ID
    return
  }
  writeStored(STORAGE_KEYS.tuning, id)
})
watch(baseBellows, (value) => writeStored(STORAGE_KEYS.bellows, value))
watch(tremoloCents, (value) => {
  const tone = clampTone(value)
  if (tone !== value) {
    tremoloCents.value = tone
    return
  }
  reedEngine.tremoloCents = tone
  writeStored(STORAGE_KEYS.tone, String(tone))
})

function midiFor(button: Button): number {
  const base = bellows.value === 'push' ? button.pushMidiBase : button.pullMidiBase
  return base + tuning.value.semitoneOffset
}

function isPlayableKey(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return false
  return event.code === 'Space' || event.key === 'Shift' || buttonForCode(event.code) !== undefined
}

function onKeyDown(event: KeyboardEvent): void {
  if (isTextEntry(event.target) || event.isComposing) return

  // Select and range keep focus while they are adjusted. A note key hands
  // focus back to the instrument and plays, instead of being swallowed.
  if (isPlayableKey(event) && document.activeElement !== soundEl.value) {
    event.preventDefault()
    focusSound()
  }

  if (event.code === 'Space') {
    event.preventDefault()
    reedEngine.ensureStarted()
    spaceHeld.value = true
    return
  }
  if (event.key === 'Shift') {
    reedEngine.ensureStarted()
    shiftHeld.value = true
    return
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return

  const button = buttonForCode(event.code)
  if (!button) return
  event.preventDefault()
  if (event.repeat) return
  holdButton(button.id, `key:${event.code}`, midiFor(button))
}

function onKeyUp(event: KeyboardEvent): void {
  if (event.code === 'Space') spaceHeld.value = false
  if (event.key === 'Shift') shiftHeld.value = false
  const button = buttonForCode(event.code)
  if (button) releaseButton(button.id, `key:${event.code}`)
}

function releaseHeldKeys(): void {
  spaceHeld.value = false
  shiftHeld.value = false
  releaseSourcesWithPrefix('key:')
}

function onWindowFocus(): void {
  if (isSettingsField(document.activeElement)) return
  focusSound()
}

onMounted(() => {
  focusSound()
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('keyup', onKeyUp, true)
  window.addEventListener('pointerdown', onPointerDownCapture, true)
  window.addEventListener('blur', releaseHeldKeys)
  window.addEventListener('focus', onWindowFocus)
  void applyKeyboardLayout()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(focusFrame)
  window.removeEventListener('keydown', onKeyDown, true)
  window.removeEventListener('keyup', onKeyUp, true)
  window.removeEventListener('pointerdown', onPointerDownCapture, true)
  window.removeEventListener('blur', releaseHeldKeys)
  window.removeEventListener('focus', onWindowFocus)
  releaseHeldKeys()
})
</script>

<template>
  <div class="app">
    <header class="toolbar">
      <span class="brand">Steirische Harmonika</span>

      <label class="control">
        <span class="control-label">Stimmung</span>
        <select v-model="tuningId" class="tuning-select" @change="scheduleFocusSound" @keydown.escape="scheduleFocusSound">
          <option v-for="t in TUNINGS" :key="t.id" :value="t.id">{{ t.label }}</option>
        </select>
      </label>

      <label class="control">
        <span class="control-label">Tremolo</span>
        <input
          v-model.number="tremoloCents"
          type="range"
          min="0"
          max="18"
          step="1"
          class="tremolo-slider"
          @pointerup="scheduleFocusSound"
          @pointercancel="scheduleFocusSound"
        />
      </label>

      <div class="control bellows-control" role="group" aria-label="Bellows direction">
        <button
          type="button"
          class="bellows-button"
          :class="{ active: bellows === 'push' }"
          @mousedown.prevent
          @click="baseBellows = 'push'"
        >
          Druck
        </button>
        <button
          type="button"
          class="bellows-button"
          :class="{ active: bellows === 'pull' }"
          @mousedown.prevent
          @click="baseBellows = 'pull'"
        >
          Zug
        </button>
        <span class="bellows-hint">Hold Space or Shift for Zug</span>
      </div>
    </header>

    <main ref="soundEl" class="stage" tabindex="-1">
      <Fingerboard :tuning-offset="tuning.semitoneOffset" :bellows="bellows" />
    </main>
  </div>
</template>
