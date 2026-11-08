import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
test('3D page is hash-navigable and lazy-loaded without replacing default board', () => {
  assert.match(app, /defineAsyncComponent\(/)
  assert.match(app, /import\('\.\/components\/Fingerboard3D.vue'\)/)
  assert.match(app, /href="#\/3d"/)
  assert.match(app, /<Fingerboard v-else/)
})
