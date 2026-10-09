import { describe, expect, it } from 'vitest'
import { percent, toCsv } from './csv'

describe('toCsv', () => {
  it('joins rows with CRLF and quotes when needed', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          [1, 'x,y'],
          [null, 'say "hi"'],
        ],
      ),
    ).toBe('a,b\r\n1,"x,y"\r\n,"say ""hi"""\r\n')
  })

  it('defuses spreadsheet formulas in text cells', () => {
    expect(toCsv(['a'], [['=SUM(A1)']])).toBe("a\r\n'=SUM(A1)\r\n")
    expect(toCsv(['n'], [[-3]])).toBe('n\r\n-3\r\n')
  })
})

describe('percent', () => {
  it('rounds, and is blank for young cohorts', () => {
    expect(percent(1, 3)).toBe('33%')
    expect(percent(null, 3)).toBe('')
    expect(percent(0, 0)).toBe('')
  })
})
