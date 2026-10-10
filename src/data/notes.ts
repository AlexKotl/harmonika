// German ("Griffschrift") note naming used on Steirische Harmonika charts:
// - Uppercase with no mark = the "great octave" (e.g. C = C2, H = B2).
// - Lowercase with no mark = the "small octave" (e.g. c = C3).
// - Lowercase with trailing "'" marks = one-line, two-line, ... octaves
//   (c' = middle C / C4, c'' = C5, c''' = C6).
// - "H" is B-natural, "B" is B-flat (same letter pattern as es/as/ges/des
//   for the other flats).
const FLAT_NAMES = ['C', 'Des', 'D', 'Es', 'E', 'F', 'Ges', 'G', 'As', 'A', 'B', 'H']

const TOKEN_TO_PITCH_CLASS: Record<string, number> = {
  c: 0,
  des: 1,
  d: 2,
  es: 3,
  e: 4,
  f: 5,
  ges: 6,
  g: 7,
  as: 8,
  a: 9,
  b: 10,
  h: 11,
}

/**
 * Parse a German note label from a Griffschrift chart (e.g. "g'", "H",
 * "des''", "b") into a MIDI note number.
 */
export function parseGermanNote(label: string): number {
  let token = label.trim()

  let primes = 0
  while (token.endsWith("'")) {
    primes++
    token = token.slice(0, -1)
  }

  let commas = 0
  while (token.endsWith(',')) {
    commas++
    token = token.slice(0, -1)
  }

  const firstChar = token.charAt(0)
  const isUpper = firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()
  const pitchClass = TOKEN_TO_PITCH_CLASS[token.toLowerCase()]
  if (pitchClass === undefined) {
    throw new Error(`Unknown German note token: "${label}"`)
  }

  let octave: number
  if (primes > 0) {
    octave = 3 + primes
  } else if (commas > 0) {
    octave = 2 - commas
  } else {
    octave = isUpper ? 2 : 3
  }

  return (octave + 1) * 12 + pitchClass
}

/** Convert a MIDI note number back to its German Griffschrift name. */
export function midiToGermanName(midi: number): string {
  const pitchClass = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  const base = FLAT_NAMES[pitchClass]

  if (octave >= 3) {
    const primes = octave - 3
    return base.toLowerCase() + "'".repeat(primes)
  }
  const commas = Math.max(0, 2 - octave)
  return base.toUpperCase() + ','.repeat(commas)
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}
