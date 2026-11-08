import test from 'node:test'
import assert from 'node:assert/strict'
import { buttonPosition, handTargets } from '../src/three/hand.ts'

const buttons = Array.from({ length: 4 }, (_, r) => Array.from({ length: 10 }, (_, index) => ({ id: `row${r + 1}-${index}`, row: r + 1, index }))).flat()
test('board preserves staggered columns and elevated inner rows', () => {
  assert.deepEqual(buttonPosition(buttons[0]!), { x: -1.8, y: 6.6, z: 0.3 })
  assert.ok(buttonPosition(buttons[10]!).x > buttonPosition(buttons[0]!).x)
  assert.ok(buttonPosition(buttons[10]!).y < buttonPosition(buttons[0]!).y)
  assert.ok(buttonPosition(buttons[10]!).z > buttonPosition(buttons[0]!).z)
})
test('presets lower index + middle or index + ring, upper ring reaches raised row', () => {
  const a = handTargets(buttons, [], 'index-middle')
  const b = handTargets(buttons, [], 'index-ring')
  const c = handTargets(buttons, [], 'index-ring-upper')
  assert.deepEqual(a.map(t => t.finger), [1, 2])
  assert.deepEqual(b.map(t => t.finger), [1, 3])
  assert.deepEqual(c.map(t => t.finger), [1, 3])
  assert.equal(a[0].button.id, b[0].button.id)
  assert.ok(buttonPosition(c[1].button).z > buttonPosition(c[0].button).z)
})
test('end-of-row preset stays on the nearest existing button instead of jumping backwards', () => {
  const extended = [...buttons, { id: 'row1-10', row: 1, index: 10 }, { id: 'row1-11', row: 1, index: 11 }]
  const targets = handTargets(extended, ['row1-10'], 'index-middle')
  assert.equal(targets[1].button.id, 'row1-11')
})

test('active chords target actual buttons, reset is stable and empty board is safe', () => {
  const active = ['row4-9', 'row1-0']
  const targets = handTargets(buttons, active, 'index-ring')
  assert.deepEqual(targets.map(t => t.button.id).sort(), [...active].sort())
  assert.deepEqual(handTargets(buttons, [], 'index-ring'), handTargets(buttons, ['unknown'], 'index-ring'))
  assert.deepEqual(handTargets([], [], 'index-middle'), [])
  for (const target of targets) assert.ok(Object.values(buttonPosition(target.button)).every(Number.isFinite))
})
