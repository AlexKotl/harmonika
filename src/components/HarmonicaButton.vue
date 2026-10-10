<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Button } from '../data/layout'
import { midiToGermanName } from '../data/notes'
import { reedEngine } from '../audio/ReedEngine'

const props = defineProps<{
  button: Button
  tuningOffset: number
  bellows: 'push' | 'pull'
}>()

const pointersDown = ref<Set<number>>(new Set())

const pushMidi = computed(() => props.button.pushMidiBase + props.tuningOffset)
const pullMidi = computed(() => props.button.pullMidiBase + props.tuningOffset)

const activeMidi = computed(() => (props.bellows === 'push' ? pushMidi.value : pullMidi.value))
const otherMidi = computed(() => (props.bellows === 'push' ? pullMidi.value : pushMidi.value))

const activeLabel = computed(() => midiToGermanName(activeMidi.value))
const otherLabel = computed(() => midiToGermanName(otherMidi.value))
const pushLabel = computed(() => midiToGermanName(pushMidi.value))
const pullLabel = computed(() => midiToGermanName(pullMidi.value))

const isPressed = computed(() => pointersDown.value.size > 0)

const accessibleName = computed(
  () => `Button ${props.button.row}-${props.button.index + 1}, push ${pushLabel.value}, pull ${pullLabel.value}`,
)

watch(activeMidi, (midi) => {
  if (isPressed.value) {
    reedEngine.retuneIfHeld(props.button.id, midi)
  }
})

function onPointerDown(event: PointerEvent): void {
  event.preventDefault()
  reedEngine.ensureStarted()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  const wasEmpty = pointersDown.value.size === 0
  pointersDown.value.add(event.pointerId)
  if (wasEmpty) {
    reedEngine.noteOn(props.button.id, activeMidi.value)
  }
}

function onPointerUp(event: PointerEvent): void {
  if (!pointersDown.value.has(event.pointerId)) return
  pointersDown.value.delete(event.pointerId)
  if (pointersDown.value.size === 0) {
    reedEngine.noteOff(props.button.id)
  }
}
</script>

<template>
  <button
    type="button"
    class="key"
    :class="{
      pressed: isPressed,
      gleichton: button.isGleichton,
      chromatic: button.isChromatic,
    }"
    :aria-label="accessibleName"
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @lostpointercapture="onPointerUp"
    @contextmenu.prevent
  >
    <span class="key-active">{{ activeLabel }}</span>
    <span class="key-other">{{ otherLabel }}</span>
  </button>
</template>
