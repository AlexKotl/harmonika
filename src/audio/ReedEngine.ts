import { midiToFrequency } from '../data/notes'

/**
 * A small free-reed synthesizer tuned to sound like an accordion/Steirische
 * reed rather than a generic synth tone.
 *
 * A real Steirische Harmonika is usually "dreichörig": each note is sounded
 * by three physical reeds, one tuned exactly on pitch and two tuned a few
 * cents sharp/flat of it, which beat against each other to create the
 * instrument's characteristic warm tremolo/chorus. We approximate that with
 * three detuned oscillators per voice sharing one amplitude envelope, plus a
 * short filtered-noise "chiff" at the very start to imitate the reed
 * starting to speak as air first reaches it.
 */

const ATTACK_SECONDS = 0.035
const RELEASE_SECONDS = 0.09
const CHIFF_SECONDS = 0.03

interface Voice {
  oscillators: OscillatorNode[]
  gain: GainNode
  chiffSource: AudioBufferSourceNode | null
  stopAt: number | null
}

export class ReedEngine {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private reedWave: PeriodicWave | null = null
  private noiseBuffer: AudioBuffer | null = null
  private voices = new Map<string, Voice>()

  /** Detune spread of the two outer reed choirs, in cents. 0 = dry/single reed. */
  tremoloCents = 9

  /** Must be called from a user gesture (pointerdown/keydown) handler. */
  ensureStarted(): void {
    if (this.context) {
      if (this.context.state === 'suspended') {
        void this.context.resume()
      }
      return
    }

    const context = new AudioContext()
    this.context = context

    this.compressor = context.createDynamicsCompressor()
    this.compressor.threshold.value = -18
    this.compressor.knee.value = 24
    this.compressor.ratio.value = 4
    this.compressor.attack.value = 0.005
    this.compressor.release.value = 0.25
    this.compressor.connect(context.destination)

    this.masterGain = context.createGain()
    this.masterGain.gain.value = 0.9
    this.masterGain.connect(this.compressor)

    this.reedWave = buildReedWave(context)
    this.noiseBuffer = buildNoiseBuffer(context)
  }

  /** Start (or re-pitch) the note held by `voiceId`. */
  noteOn(voiceId: string, midiNote: number): void {
    const context = this.context
    const masterGain = this.masterGain
    const reedWave = this.reedWave
    if (!context || !masterGain || !reedWave) return

    // Re-triggering the same id (e.g. bellows direction flipped while held)
    // retunes in place instead of restarting the envelope, like a reed
    // instrument sliding to a new pitch rather than re-articulating.
    const existing = this.voices.get(voiceId)
    if (existing && existing.stopAt === null) {
      this.retune(existing, midiNote)
      return
    }
    if (existing) {
      this.disposeVoice(existing)
    }

    const now = context.currentTime
    const frequency = midiToFrequency(midiNote)

    const gain = context.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(1, now + ATTACK_SECONDS)
    gain.connect(masterGain)

    const detunes = [-this.tremoloCents, 0, this.tremoloCents]
    const gains = [0.32, 0.4, 0.32]
    const oscillators = detunes.map((detune, i) => {
      const osc = context.createOscillator()
      osc.setPeriodicWave(reedWave)
      osc.frequency.value = frequency
      osc.detune.value = detune

      const voiceGain = context.createGain()
      voiceGain.gain.value = gains[i]
      osc.connect(voiceGain)
      voiceGain.connect(gain)

      osc.start(now)
      return osc
    })

    let chiffSource: AudioBufferSourceNode | null = null
    if (this.noiseBuffer) {
      chiffSource = context.createBufferSource()
      chiffSource.buffer = this.noiseBuffer
      const chiffFilter = context.createBiquadFilter()
      chiffFilter.type = 'bandpass'
      chiffFilter.frequency.value = Math.min(frequency * 2.5, 4000)
      chiffFilter.Q.value = 0.7
      const chiffGain = context.createGain()
      chiffGain.gain.setValueAtTime(0.5, now)
      chiffGain.gain.exponentialRampToValueAtTime(0.001, now + CHIFF_SECONDS)
      chiffSource.connect(chiffFilter)
      chiffFilter.connect(chiffGain)
      chiffGain.connect(masterGain)
      chiffSource.start(now)
      chiffSource.stop(now + CHIFF_SECONDS + 0.01)
    }

    this.voices.set(voiceId, { oscillators, gain, chiffSource, stopAt: null })
  }

  /** Re-pitch an already-sounding voice without restarting its envelope. */
  private retune(voice: Voice, midiNote: number): void {
    const context = this.context
    if (!context) return
    const frequency = midiToFrequency(midiNote)
    const now = context.currentTime
    const glide = 0.03
    for (const osc of voice.oscillators) {
      osc.frequency.cancelScheduledValues(now)
      osc.frequency.setTargetAtTime(frequency, now, glide)
    }
  }

  retuneIfHeld(voiceId: string, midiNote: number): void {
    const voice = this.voices.get(voiceId)
    if (voice && voice.stopAt === null) {
      this.retune(voice, midiNote)
    }
  }

  noteOff(voiceId: string): void {
    const context = this.context
    const voice = this.voices.get(voiceId)
    if (!context || !voice || voice.stopAt !== null) return

    const now = context.currentTime
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now)
    voice.gain.gain.linearRampToValueAtTime(0, now + RELEASE_SECONDS)

    const stopAt = now + RELEASE_SECONDS + 0.02
    voice.stopAt = stopAt
    for (const osc of voice.oscillators) {
      osc.stop(stopAt)
    }

    const timeoutMs = (RELEASE_SECONDS + 0.05) * 1000
    setTimeout(() => {
      const current = this.voices.get(voiceId)
      if (current === voice) {
        this.voices.delete(voiceId)
      }
    }, timeoutMs)
  }

  private disposeVoice(voice: Voice): void {
    for (const osc of voice.oscillators) {
      try {
        osc.stop()
      } catch {
        // already stopped
      }
    }
  }
}

/**
 * Build a periodic wave shaped like a free reed: a buzzy mix of even and odd
 * harmonics that falls off gently, then gets softened by a lowpass so it
 * reads as nasal/woody instead of a bright buzzy saw.
 */
function buildReedWave(context: AudioContext): PeriodicWave {
  const harmonicCount = 24
  const real = new Float32Array(harmonicCount)
  const imag = new Float32Array(harmonicCount)

  for (let n = 1; n < harmonicCount; n++) {
    const falloff = 1 / Math.pow(n, 1.3)
    // Gentle lowpass-like shaping: roll off the top harmonics faster so the
    // tone stays warm rather than buzzy.
    const brightness = n <= 6 ? 1 : Math.max(0, 1 - (n - 6) / 14)
    imag[n] = falloff * brightness
  }

  return context.createPeriodicWave(real, imag, { disableNormalization: false })
}

function buildNoiseBuffer(context: AudioContext): AudioBuffer {
  const duration = 0.05
  const length = Math.ceil(context.sampleRate * duration)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

/** Single shared engine instance for the whole app. */
export const reedEngine = new ReedEngine()
