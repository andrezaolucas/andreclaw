import { describe, expect, test } from 'bun:test'

import {
  endOfWeek,
  extractDateFromFilename,
  parseIsoDate,
  startOfWeek,
  toIsoDate,
} from './dateHelpers.js'

describe('dateHelpers', () => {
  test('startOfWeek pega segunda a partir de qualquer dia', () => {
    // 2026-07-23 e quinta
    const thursday = new Date('2026-07-23T15:00:00Z')
    const monday = startOfWeek(thursday)
    expect(toIsoDate(monday)).toBe('2026-07-20')
  })

  test('startOfWeek em domingo pega segunda anterior', () => {
    // 2026-07-19 = domingo → segunda anterior 2026-07-13
    const sunday = new Date('2026-07-19T00:00:00Z')
    expect(toIsoDate(startOfWeek(sunday))).toBe('2026-07-13')
  })

  test('startOfWeek em segunda retorna ela mesma', () => {
    const monday = new Date('2026-07-20T12:00:00Z')
    expect(toIsoDate(startOfWeek(monday))).toBe('2026-07-20')
  })

  test('endOfWeek pega domingo 23:59', () => {
    const wednesday = new Date('2026-07-22T15:00:00Z')
    const sunday = endOfWeek(wednesday)
    expect(toIsoDate(sunday)).toBe('2026-07-26')
    expect(sunday.getUTCHours()).toBe(23)
  })

  test('parseIsoDate valido', () => {
    const d = parseIsoDate('2026-07-23')!
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(6) // 0-indexed
    expect(d.getUTCDate()).toBe(23)
  })

  test('parseIsoDate invalido retorna null', () => {
    expect(parseIsoDate('nao-e-data')).toBeNull()
    expect(parseIsoDate('2026/07/23')).toBeNull()
    expect(parseIsoDate('2026-13-01')).not.toBeNull() // JS aceita rollover mes 13
  })

  test('extractDateFromFilename', () => {
    expect(toIsoDate(extractDateFromFilename('2026-07-23.md')!)).toBe('2026-07-23')
    expect(toIsoDate(extractDateFromFilename('2026-07-23-extra.md')!)).toBe('2026-07-23')
    expect(extractDateFromFilename('sem-data.md')).toBeNull()
    expect(extractDateFromFilename('README.md')).toBeNull()
  })

  test('toIsoDate consistente', () => {
    const d = new Date('2026-01-01T23:59:59Z')
    expect(toIsoDate(d)).toBe('2026-01-01')
  })
})
