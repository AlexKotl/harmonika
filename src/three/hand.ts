export interface BoardButton { id: string; row: number; index: number }
export interface Point { x: number; y: number; z: number }
export type Preset = 'index-middle' | 'index-ring' | 'index-ring-upper'
export function handTargets(buttons: BoardButton[], activeIds: string[], preset: Preset) {
  const anchor = buttons.find(button => activeIds.includes(button.id)) ?? buttons.find(button => button.row === 2 && button.index === 4) ?? buttons[0]
  if (!anchor) return []
  const targetRow = Math.min(4, anchor.row + (preset === 'index-ring-upper' ? 1 : 0))
  const rowButtons = buttons.filter(button => button.row === targetRow)
  const nearestIndex = Math.min(anchor.index + 1, Math.max(...rowButtons.map(button => button.index)))
  const second = buttons.find(button => activeIds.includes(button.id) && button.id !== anchor.id)
    ?? rowButtons.find(button => button.index === nearestIndex) ?? anchor
  return [{ finger: 1, button: anchor }, { finger: preset === 'index-middle' ? 2 : 3, button: second }]
}
export function buttonPosition(button: BoardButton): Point {
  return { x: (button.row * 12 - 30) / 10, y: 6.6 - button.index * 1.1 - (button.row - 1) * 0.55, z: 0.3 + (button.row - 1) * 0.18 }
}
