<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { ROWS } from '../data/layout'
import { midiToGermanName } from '../data/notes'
import { hotkeysByButtonId } from '../input/keyboardMap'
import { holdButton, isButtonHeld, releaseButton, releaseSourcesWithPrefix } from '../input/holds'
import { reedEngine } from '../audio/ReedEngine'
import { buttonPosition, handTargets, type Preset } from '../three/hand'
import Fingerboard from './Fingerboard.vue'

const props = defineProps<{ tuningOffset: number; bellows: 'push' | 'pull' }>()
const buttons = ROWS.flatMap(row => row.buttons)
const preset = ref<Preset>('index-middle')
const host = ref<HTMLDivElement | null>(null)
const failed = ref(false)
const active = computed(() => buttons.filter(button => isButtonHeld(button.id)))
const activeText = computed(() => active.value.map(button => `${hotkeysByButtonId[button.id]?.label ?? button.id} (${midiToGermanName(midi(button))})`).join(', ') || 'None')
function midi(button: typeof buttons[number]) {
  return (props.bellows === 'push' ? button.pushMidiBase : button.pullMidiBase) + props.tuningOffset
}
watch(() => [props.bellows, props.tuningOffset], () => {
  for (const button of active.value) reedEngine.retuneIfHeld(button.id, midi(button))
}, { immediate: true })
let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let observer: ResizeObserver | undefined
let frame = 0
let cleanup = () => {}
const pointerButtons = new Map<number, string>()
function releasePointers() {
  pointerButtons.clear()
  releaseSourcesWithPrefix('three:')
}
onMounted(() => {
  if (!host.value) return
  scene = new THREE.Scene()
  scene.background = new THREE.Color('#171e2a')
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true })
  } catch {
    failed.value = true
    return
  }
  const canvas = renderer.domElement
  canvas.setAttribute('aria-label', '3D harmonika: play with keyboard or press buttons with mouse or touch')
  canvas.setAttribute('role', 'img')
  host.value.appendChild(canvas)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  const camera = new THREE.OrthographicCamera(-5, 5, 9, -9, 0.1, 100)
  camera.position.set(5, -5, 27)
  camera.lookAt(0, 0, 0)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 2.5))
  const light = new THREE.DirectionalLight(0xffffff, 3)
  light.position.set(-3, 7, 10)
  scene.add(light)
  const keyGeometry = new THREE.CylinderGeometry(0.44, 0.46, 0.24, 32)
  keyGeometry.rotateX(Math.PI / 2)
  const keyMeshes: THREE.Mesh[] = []
  const labels: THREE.Sprite[] = []
  const resources: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [keyGeometry]
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material) {
    const result = new THREE.Mesh(geometry, material)
    scene!.add(result)
    resources.push(geometry, material)
    return result
  }
  for (const row of ROWS) {
    const base = mesh(new THREE.BoxGeometry(1.08, 15, 0.3), new THREE.MeshStandardMaterial({ color: '#653a30', roughness: 0.6 }))
    base.position.set(buttonPosition(row.buttons[0]!).x, -0.3, (row.row - 1) * 0.18 - 0.05)
  }
  for (const button of buttons) {
    const material = new THREE.MeshStandardMaterial({ color: button.isGleichton ? '#e6ba61' : '#eee5d5', roughness: 0.35 })
    resources.push(material)
    const key = new THREE.Mesh(keyGeometry, material)
    const p = buttonPosition(button)
    key.position.set(p.x, p.y, p.z)
    key.userData.id = button.id
    scene.add(key)
    keyMeshes.push(key)
    const texture = new THREE.CanvasTexture(document.createElement('canvas'))
    texture.image.width = 128
    texture.image.height = 128
    const labelMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false })
    const label = new THREE.Sprite(labelMaterial)
    label.scale.set(0.85, 0.85, 1)
    label.position.set(p.x, p.y, p.z + 0.15)
    scene.add(label)
    labels.push(label)
    resources.push(texture, labelMaterial)
  }
  function updateLabels() {
    buttons.forEach((button, index) => {
      const texture = (labels[index]!.material as THREE.SpriteMaterial).map!
      const ctx = (texture.image as HTMLCanvasElement).getContext('2d')!
      ctx.clearRect(0, 0, 128, 128)
      ctx.fillStyle = '#19202b'
      ctx.textAlign = 'center'
      ctx.font = 'bold 34px sans-serif'
      ctx.fillText(midiToGermanName(midi(button)), 64, 55)
      ctx.font = '28px sans-serif'
      ctx.fillText(hotkeysByButtonId[button.id]?.label ?? '—', 64, 94)
      texture.needsUpdate = true
    })
  }
  const stopLabels = watch(() => [props.bellows, props.tuningOffset, ...buttons.map(button => hotkeysByButtonId[button.id]?.label)], updateLabels, { immediate: true })
  const skin = new THREE.MeshStandardMaterial({ color: '#e8a77d', roughness: 0.75, transparent: true, opacity: 0.86 })
  const palm = mesh(new THREE.SphereGeometry(1, 24, 16), skin)
  palm.scale.set(0.8, 1.2, 0.35)
  const jointGeometry = new THREE.SphereGeometry(0.16, 12, 8)
  const segmentGeometry = new THREE.CylinderGeometry(0.13, 0.16, 1, 12)
  resources.push(jointGeometry, segmentGeometry)
  const fingers = Array.from({ length: 5 }, () => ({
    joints: Array.from({ length: 4 }, () => mesh(jointGeometry, skin)),
    segments: Array.from({ length: 3 }, () => mesh(segmentGeometry, skin)),
  }))
  const up = new THREE.Vector3(0, 1, 0)
  function render() {
    const ids = active.value.map(button => button.id)
    buttons.forEach((button, index) => {
      const pressed = ids.includes(button.id)
      const key = keyMeshes[index]!
      const p = buttonPosition(button)
      key.position.z = THREE.MathUtils.lerp(key.position.z, p.z - (pressed ? 0.13 : 0), 0.3)
      ;(key.material as THREE.MeshStandardMaterial).emissive.set(pressed ? '#986a05' : '#000000')
      labels[index]!.position.z = key.position.z + 0.15
    })
    const targets = handTargets(buttons, ids, preset.value)
    const anchor = buttonPosition(targets[0]!.button)
    // shortcut: a stylized elastic hand, not anatomical IK; upgrade for fingering instruction.
    const palmTarget = new THREE.Vector3(anchor.x + 2.1, anchor.y - 0.6, 2.7)
    palm.position.lerp(palmTarget, 0.25)
    fingers.forEach((finger, index) => {
      const target = targets.find(entry => entry.finger === index)
      const root = palm.position.clone().add(new THREE.Vector3(index === 0 ? -0.1 : -0.5, (2 - index) * 0.43, 0))
      let tip = root.clone().add(new THREE.Vector3(-0.7, 0.2, 0.75))
      if (target) {
        const p = buttonPosition(target.button)
        tip = new THREE.Vector3(p.x, p.y, p.z + 0.28 - (ids.includes(target.button.id) ? 0.13 : 0))
      }
      const points = [root, root.clone().lerp(tip, 0.38).add(new THREE.Vector3(0, 0, 0.45)), root.clone().lerp(tip, 0.72).add(new THREE.Vector3(0, 0, 0.3)), tip]
      finger.joints.forEach((joint, i) => joint.position.copy(points[i]!))
      finger.segments.forEach((segment, i) => {
        const a = points[i]!, b = points[i + 1]!
        segment.position.copy(a).add(b).multiplyScalar(0.5)
        segment.scale.y = a.distanceTo(b)
        segment.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize())
      })
    })
    renderer!.render(scene!, camera)
    frame = requestAnimationFrame(render)
  }
  const raycaster = new THREE.Raycaster()
  function pointerDown(event: PointerEvent) {
    if (event.button !== 0) return
    event.preventDefault()
    const rect = canvas.getBoundingClientRect()
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera)
    const hit = raycaster.intersectObjects(keyMeshes)[0]
    if (!hit) return
    const button = buttons.find(button => button.id === hit.object.userData.id)!
    canvas.setPointerCapture(event.pointerId)
    pointerButtons.set(event.pointerId, button.id)
    holdButton(button.id, `three:${event.pointerId}`, midi(button))
  }
  function pointerUp(event: PointerEvent) {
    const id = pointerButtons.get(event.pointerId)
    if (id) releaseButton(id, `three:${event.pointerId}`)
    pointerButtons.delete(event.pointerId)
  }
  function contextLost(event: Event) {
    event.preventDefault()
    releasePointers()
    cancelAnimationFrame(frame)
    failed.value = true
  }
  canvas.addEventListener('pointerdown', pointerDown)
  canvas.addEventListener('pointerup', pointerUp)
  canvas.addEventListener('pointercancel', pointerUp)
  canvas.addEventListener('lostpointercapture', pointerUp)
  canvas.addEventListener('webglcontextlost', contextLost)
  window.addEventListener('blur', releasePointers)
  observer = new ResizeObserver(() => {
    if (!host.value || !renderer) return
    const { width, height } = host.value.getBoundingClientRect()
    renderer.setSize(width, height)
    const halfHeight = Math.max(8.7, 4.3 / (width / Math.max(height, 1)))
    camera.top = halfHeight
    camera.bottom = -halfHeight
    camera.left = -halfHeight * width / Math.max(height, 1)
    camera.right = -camera.left
    camera.updateProjectionMatrix()
  })
  observer.observe(host.value)
  render()
  cleanup = () => {
    stopLabels()
    canvas.removeEventListener('pointerdown', pointerDown)
    canvas.removeEventListener('pointerup', pointerUp)
    canvas.removeEventListener('pointercancel', pointerUp)
    canvas.removeEventListener('lostpointercapture', pointerUp)
    canvas.removeEventListener('webglcontextlost', contextLost)
    window.removeEventListener('blur', releasePointers)
    for (const resource of new Set(resources)) resource.dispose()
    canvas.remove()
  }
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  observer?.disconnect()
  releasePointers()
  cleanup()
  renderer?.dispose()
})
</script>

<template>
  <section class="three-page" aria-label="3D harmonika test page">
    <div class="three-controls">
      <label>Hand shape
        <select v-model="preset">
          <option value="index-middle">1 + 2: index and middle down</option>
          <option value="index-ring">1 + 3: index and ring down</option>
          <option value="index-ring-upper">1 + 3: ring on upper row</option>
        </select>
      </label>
      <p>1 = index, 2 = middle, 3 = ring; thumb is separate. Play the usual keys or touch the buttons.</p>
      <p>Active keys: {{ activeText }}</p>
    </div>
    <template v-if="failed">
      <p role="status">3D graphics are unavailable. You can still play the 2D instrument below.</p>
      <Fingerboard :tuning-offset="tuningOffset" :bellows="bellows" />
    </template>
    <div v-show="!failed" ref="host" class="three-canvas" />
  </section>
</template>

<style scoped>
.three-page { width: 100%; height: 100%; min-height: 0; display: flex; flex-direction: column; }
.three-controls { padding: 8px 16px; font-size: 13px; }
.three-controls label { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.three-controls select { max-width: 100%; padding: 6px; }
.three-controls p { margin: 5px 0; }
.three-canvas { flex: 1; min-height: 0; overflow: hidden; }
.three-canvas :deep(canvas) { display: block; touch-action: none; width: 100%; height: 100%; }
</style>
