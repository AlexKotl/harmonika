import { parseGermanNote } from './notes'

/**
 * The standard 4-row, 46-button Steirische Harmonika diskant (melody side),
 * as built e.g. by Öllerer, in the default G-C-F-B tuning. Source chart:
 * https://ziach.de/tastenbelegung
 *
 * Rows are given outer (row 1, key of G) to inner (row 4, key of B-flat).
 * Each button has a Druck (push/bellows-closing) and Zug (pull/bellows-
 * opening) note, written in German Griffschrift spelling. Buttons where
 * push and pull are the same pitch are "Gleichtöne" - orientation notes
 * that sound identical in both bellows directions.
 */
interface RawButton {
  push: string
  pull: string
  /** Auxiliary button outside the row's diatonic scale (chromatic helper). */
  chromatic?: boolean
}

interface RawRow {
  /** 1 = outermost row (rightmost column as the player sees the keyboard). */
  row: 1 | 2 | 3 | 4
  /** Tonic of this row in the default G-C-F-B tuning. */
  tonicLabel: string
  buttons: RawButton[]
}

const RAW_ROWS: RawRow[] = [
  {
    row: 1,
    tonicLabel: 'G',
    buttons: [
      { push: "as'", pull: "des''", chromatic: true },
      { push: 'H', pull: 'd' },
      { push: 'd', pull: 'ges' },
      { push: 'g', pull: 'a' },
      { push: 'h', pull: "c'" },
      { push: "d'", pull: "e'" },
      { push: "g'", pull: "ges'" },
      { push: "h'", pull: "a'" },
      { push: "d''", pull: "c''" },
      { push: "g''", pull: "e''" },
      { push: "h''", pull: "ges''" },
      { push: "d'''", pull: "a''" },
      { push: "g'''", pull: "c'''" },
    ],
  },
  {
    row: 2,
    tonicLabel: 'C',
    buttons: [
      { push: 'c', pull: 'f' },
      { push: 'e', pull: 'g' },
      { push: 'g', pull: 'h' },
      { push: "c'", pull: "d'" },
      { push: "e'", pull: "f'" },
      { push: "g'", pull: "g'" },
      { push: "c''", pull: "h'" },
      { push: "e''", pull: "d''" },
      { push: "g''", pull: "f''" },
      { push: "c'''", pull: "a''" },
      { push: "e'''", pull: "h''" },
      { push: "g'''", pull: "d'''" },
    ],
  },
  {
    row: 3,
    tonicLabel: 'F',
    buttons: [
      { push: 'f', pull: 'b' },
      { push: 'a', pull: "c'" },
      { push: "c'", pull: "e'" },
      { push: "f'", pull: "g'" },
      { push: "a'", pull: "b'" },
      { push: "c''", pull: "c''" },
      { push: "f''", pull: "e''" },
      { push: "a''", pull: "g''" },
      { push: "c'''", pull: "b''" },
      { push: "f'''", pull: "d'''" },
      { push: "a'''", pull: "e'''" },
    ],
  },
  {
    row: 4,
    tonicLabel: 'B',
    buttons: [
      { push: 'b', pull: "es'" },
      { push: "d'", pull: "f'" },
      { push: "f'", pull: "a'" },
      { push: "b'", pull: "c''" },
      { push: "d''", pull: "es''" },
      { push: "f''", pull: "f''" },
      { push: "b''", pull: "a''" },
      { push: "d'''", pull: "c'''" },
      { push: "f'''", pull: "es'''" },
      { push: "b'''", pull: "g'''" },
    ],
  },
]

export interface Button {
  /** Stable id, e.g. "row1-3". */
  id: string
  row: 1 | 2 | 3 | 4
  /** Position within the row, 0 = topmost / lowest-pitched. */
  index: number
  /** Base MIDI note number for Druck (push), in the default G-C-F-B tuning. */
  pushMidiBase: number
  /** Base MIDI note number for Zug (pull), in the default G-C-F-B tuning. */
  pullMidiBase: number
  /** True when push and pull sound the same pitch (an orientation note). */
  isGleichton: boolean
  /** True for the auxiliary chromatic helper button. */
  isChromatic: boolean
}

export interface Row {
  row: 1 | 2 | 3 | 4
  tonicLabel: string
  buttons: Button[]
}

export const ROWS: Row[] = RAW_ROWS.map((raw) => ({
  row: raw.row,
  tonicLabel: raw.tonicLabel,
  buttons: raw.buttons.map((button, index) => {
    const pushMidiBase = parseGermanNote(button.push)
    const pullMidiBase = parseGermanNote(button.pull)
    return {
      id: `row${raw.row}-${index}`,
      row: raw.row,
      index,
      pushMidiBase,
      pullMidiBase,
      isGleichton: pushMidiBase === pullMidiBase,
      isChromatic: button.chromatic ?? false,
    }
  }),
}))

export const TOTAL_BUTTON_COUNT = ROWS.reduce((sum, row) => sum + row.buttons.length, 0)
