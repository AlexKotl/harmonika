<script setup lang="ts">
import { computed, watch } from 'vue'
import type { Button } from '../data/layout'
import { midiToGermanName } from '../data/notes'
import { reedEngine } from '../audio/ReedEngine'
import { holdButton, isButtonHeld, releaseButton } from '../input/holds'
import { hotkeysByButtonId } from '../input/keyboardMap'

const props = defineProps<{
  button: Button
  tuningOffset: number
  bellows: 'push' | 'pull'
}>()

const pushMidi = computed(() => props.button.pushMidiBase + props.tuningOffset)
const pullMidi = computed(() => props.button.pullMidiBase + props.tuningOffset)

const activeMidi = computed(() => (props.bellows === 'push' ? pushMidi.value : pullMidi.value))
const otherMidi = computed(() => (props.bellows === 'push' ? pullMidi.value : pushMidi.value))

const activeLabel = computed(() => midiToGermanName(activeMidi.value))
const otherLabel = computed(() => midiToGermanName(otherMidi.value))
const pushLabel = computed(() => midiToGermanName(pushMidi.value))
const pullLabel = computed(() => midiToGermanName(pullMidi.value))

const hotkey = computed(() => hotkeysByButtonId[props.button.id])
const isPressed = computed(() => isButtonHeld(props.button.id))

const accessibleName = computed(() => {
  const key = hotkey.value ? `, key ${hotkey.value.label}` : ''
  return `Button ${props.button.row}-${props.button.index + 1}${key}, push ${pushLabel.value}, pull ${pullLabel.value}`
})

watch(activeMidi, (midi) => {
  if (isPressed.value) {
    reedEngine.retuneIfHeld(props.button.id, midi)
  }
})

function onPointerDown(event: PointerEvent): void {
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  holdButton(props.button.id, `pointer:${event.pointerId}`, activeMidi.value)
}

function onPointerUp(event: PointerEvent): void {
  releaseButton(props.button.id, `pointer:${event.pointerId}`)
}
</script>

<template>
  <button
    type="button"
    tabindex="-1"
    class="key"
    :class="{
      pressed: isPressed,
      gleichton: button.isGleichton,
      chromatic: button.isChromatic,
    }"
    :aria-label="accessibleName"
    :data-key="hotkey?.code"
    @mousedown.prevent
    @pointerdown="onPointerDown"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @lostpointercapture="onPointerUp"
    @contextmenu.prevent
  >
    <span class="key-active">{{ activeLabel }}</span>
    <span class="key-other">{{ otherLabel }}</span>
    <kbd v-if="hotkey" class="key-hotkey">{{ hotkey.label }}</kbd>
  </button>
</template>
