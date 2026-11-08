import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileScript, parse } from '@vue/compiler-sfc'
import { build } from 'esbuild'
import * as vue from 'vue'
import * as THREE from 'three'

type SetupHarness = {
  default: { setup(props: object, context: { expose(): void }): unknown }
} & Pick<typeof import('../src/data/layout.ts'), 'ROWS'>
  & Pick<typeof import('../src/input/holds.ts'), 'holdButton' | 'releaseSourcesWithPrefix'>
  & Pick<typeof import('../src/audio/ReedEngine.ts'), 'reedEngine'>

// Execute the real component setup and input state; only browser lifecycles and audio are stubbed.
async function loadFingerboardSetup() {
  const filename = fileURLToPath(new URL('../src/components/Fingerboard3D.vue', import.meta.url))
  const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
  const script = compileScript(descriptor, { id: 'retuning-test' })
  const result = await build({
    stdin: {
      contents: `${script.content}\nexport { ROWS, holdButton, releaseSourcesWithPrefix, reedEngine }`,
      loader: 'ts',
      resolveDir: dirname(filename),
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    plugins: [{
      name: 'skip-fallback-rendering',
      setup(build) {
        build.onLoad({ filter: /\.vue$/ }, () => ({ contents: 'export default {}' }))
      },
    }],
  })
  const require = createRequire(import.meta.url)
  const module = { exports: {} as SetupHarness }
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(
    (id: string) => {
      if (id === 'vue') return { ...vue, onMounted() {}, onBeforeUnmount() {} }
      if (id === 'three') return THREE
      return require(id)
    },
    module,
    module.exports,
  )
  return module.exports
}

test('lazy 3D setup retunes an already-held note to the current bellows and tuning', async t => {
  const { default: component, ROWS, holdButton, releaseSourcesWithPrefix, reedEngine } = await loadFingerboardSetup()
  const button = ROWS[0].buttons[0]
  const voices = new Map<string, number>()
  t.mock.method(reedEngine, 'ensureStarted', () => {})
  const noteOn = t.mock.method(reedEngine, 'noteOn', (id: string, midi: number) => { voices.set(id, midi) })
  t.mock.method(reedEngine, 'noteOff', id => voices.delete(id))
  t.mock.method(reedEngine, 'retuneIfHeld', (id, midi) => {
    if (voices.has(id)) voices.set(id, midi)
  })
  const props = vue.reactive({ bellows: 'push', tuningOffset: 0 })
  const scope = vue.effectScope()
  t.after(() => {
    scope.stop()
    releaseSourcesWithPrefix('key:')
  })

  holdButton(button.id, 'key:KeyQ', button.pushMidiBase)
  // Settings change while the first lazy import is still pending.
  props.bellows = 'pull'
  props.tuningOffset = 2
  assert.equal(voices.get(button.id), button.pushMidiBase)

  scope.run(() => component.setup(props, { expose() {} }))

  assert.equal(voices.get(button.id), button.pullMidiBase + props.tuningOffset)
  assert.equal(noteOn.mock.callCount(), 1, 'retuning must not restart the held note')
})
