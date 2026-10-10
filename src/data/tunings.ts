export interface Tuning {
  id: string
  /** Display label, outer row to inner row, e.g. "G · C · F · B". */
  label: string
  /** Semitones to add to the base G-C-F-B layout to reach this tuning. */
  semitoneOffset: number
}

// Common Steirische Harmonika tunings. Each is the base G-C-F-B button
// chart transposed as a whole - the fingering never changes, only the
// pitch, exactly like swapping to a differently-tuned instrument.
export const TUNINGS: Tuning[] = [
  { id: 'f-b-es-as', label: 'F · B · Es · As', semitoneOffset: -2 },
  { id: 'fis-h-e-a', label: 'Fis · H · E · A', semitoneOffset: -1 },
  { id: 'g-c-f-b', label: 'G · C · F · B', semitoneOffset: 0 },
  { id: 'as-des-ges-h', label: 'As · Des · Ges · H', semitoneOffset: 1 },
  { id: 'a-d-g-c', label: 'A · D · G · C', semitoneOffset: 2 },
  { id: 'b-es-as-des', label: 'B · Es · As · Des', semitoneOffset: 3 },
  { id: 'h-e-a-d', label: 'H · E · A · D', semitoneOffset: 4 },
  { id: 'c-f-b-es', label: 'C · F · B · Es', semitoneOffset: 5 },
]

export const DEFAULT_TUNING_ID = 'g-c-f-b'

export function getTuning(id: string): Tuning {
  return TUNINGS.find((t) => t.id === id) ?? TUNINGS.find((t) => t.id === DEFAULT_TUNING_ID)!
}
