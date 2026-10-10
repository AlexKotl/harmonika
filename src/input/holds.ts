import { reactive } from 'vue'
import { reedEngine } from '../audio/ReedEngine'

/** Sources currently holding each button, e.g. "pointer:3" or "key:KeyQ". */
const sources = reactive<Record<string, string[]>>({})

export function isButtonHeld(buttonId: string): boolean {
  return (sources[buttonId]?.length ?? 0) > 0
}

export function holdButton(buttonId: string, source: string, midi: number): void {
  reedEngine.ensureStarted()
  const current = sources[buttonId]
  if (!current) {
    sources[buttonId] = [source]
    reedEngine.noteOn(buttonId, midi)
    return
  }
  if (current.includes(source)) return
  current.push(source)
}

export function releaseButton(buttonId: string, source: string): void {
  const current = sources[buttonId]
  if (!current) return
  const next = current.filter((entry) => entry !== source)
  if (next.length === current.length) return
  if (next.length === 0) {
    delete sources[buttonId]
    reedEngine.noteOff(buttonId)
    return
  }
  sources[buttonId] = next
}

export function releaseSourcesWithPrefix(prefix: string): void {
  for (const buttonId of Object.keys(sources)) {
    const current = sources[buttonId]
    if (!current?.some((entry) => entry.startsWith(prefix))) continue
    const next = current.filter((entry) => !entry.startsWith(prefix))
    if (next.length === 0) {
      delete sources[buttonId]
      reedEngine.noteOff(buttonId)
    } else {
      sources[buttonId] = next
    }
  }
}
