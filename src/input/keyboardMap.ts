import { reactive } from 'vue'
import { ROWS, type Button } from '../data/layout'

/**
 * Computer keys for one button column, listed from the bottom button upward.
 *
 * Rotate the keyboard 90° clockwise so Q, A, and Z are nearest you. Columns
 * then run left to right as the number row, Q, A, and Z — the same order as
 * the buttons on screen. The leftmost key of each row is that column's bottom
 * button; keys further right play upward.
 */
const KEYS_FROM_BOTTOM: Record<Button['row'], readonly string[]> = {
  1: [
    'Backquote',
    'Digit1',
    'Digit2',
    'Digit3',
    'Digit4',
    'Digit5',
    'Digit6',
    'Digit7',
    'Digit8',
    'Digit9',
    'Digit0',
    'Minus',
    'Equal',
  ],
  2: [
    'KeyQ',
    'KeyW',
    'KeyE',
    'KeyR',
    'KeyT',
    'KeyY',
    'KeyU',
    'KeyI',
    'KeyO',
    'KeyP',
    'BracketLeft',
    'BracketRight',
  ],
  3: [
    'KeyA',
    'KeyS',
    'KeyD',
    'KeyF',
    'KeyG',
    'KeyH',
    'KeyJ',
    'KeyK',
    'KeyL',
    'Semicolon',
    'Quote',
  ],
  4: ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'],
}

const CODE_LABELS: Record<string, string> = {
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
}

function labelForCode(code: string): string {
  if (CODE_LABELS[code]) return CODE_LABELS[code]
  if (code.startsWith('Digit')) return code.slice('Digit'.length)
  if (code.startsWith('Key')) return code.slice('Key'.length)
  return code
}

export interface Hotkey {
  code: string
  label: string
}

const codeToButton = new Map<string, Button>()
export const hotkeysByButtonId = reactive<Record<string, Hotkey>>({})

for (const row of ROWS) {
  const keys = KEYS_FROM_BOTTOM[row.row]
  if (keys.length !== row.buttons.length) {
    throw new Error(`Row ${row.row} has ${row.buttons.length} buttons but ${keys.length} keys`)
  }
  row.buttons.forEach((button, index) => {
    const fromBottom = keys.length - 1 - index
    const code = keys[fromBottom]
    if (!code) return
    codeToButton.set(code, button)
    hotkeysByButtonId[button.id] = { code, label: labelForCode(code) }
  })
}

export function buttonForCode(code: string): Button | undefined {
  return codeToButton.get(code)
}

/** Show the characters printed on the keys, when the browser can tell us. */
export async function applyKeyboardLayout(): Promise<void> {
  const keyboard = (navigator as Navigator & {
    keyboard?: { getLayoutMap?: () => Promise<{ get(code: string): string | undefined }> }
  }).keyboard
  if (!keyboard?.getLayoutMap) return
  try {
    const map = await keyboard.getLayoutMap()
    for (const hotkey of Object.values(hotkeysByButtonId)) {
      const legend = map.get(hotkey.code)
      if (!legend) continue
      const upper = legend.toUpperCase()
      hotkey.label = upper.length === 1 ? upper : legend
    }
  } catch {
    // keep the labels that match a US QWERTY keyboard
  }
}
