import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, rm, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import {
  bucketByWeek,
  pickConsolidatableWeeks,
  scanDailies,
} from './dailyScanner.js'
import type { DailyNote } from './types.js'

let tempDir: string

beforeEach(async () => {
  tempDir = join(tmpdir(), `vault-daily-${Date.now()}-${Math.random()}`)
  await mkdir(tempDir, { recursive: true })
})

afterEach(async () => {
  if (existsSync(tempDir)) {
    await rm(tempDir, { recursive: true, force: true })
  }
})

describe('scanDailies', () => {
  test('vazio quando pasta nao existe', async () => {
    expect(await scanDailies('/nao/existe/pasta')).toEqual([])
  })

  test('vazio quando pasta sem .md', async () => {
    await writeFile(join(tempDir, 'README.txt'), 'nada')
    expect(await scanDailies(tempDir)).toEqual([])
  })

  test('ignora arquivos sem prefixo de data', async () => {
    await writeFile(join(tempDir, 'notas-gerais.md'), '# stuff')
    await writeFile(join(tempDir, '2026-07-23.md'), '# daily')
    const notes = await scanDailies(tempDir)
    expect(notes).toHaveLength(1)
    expect(notes[0].filename).toBe('2026-07-23.md')
  })

  test('parseia frontmatter e conteudo', async () => {
    const content = `---
type: daily
status: ativo
consolidatedAt: 2026-07-27
---

# 2026-07-23

Fiz coisa X hoje.`
    await writeFile(join(tempDir, '2026-07-23.md'), content)
    const notes = await scanDailies(tempDir)
    expect(notes).toHaveLength(1)
    expect(notes[0].frontmatter.type).toBe('daily')
    expect(notes[0].consolidatedAt).toBe('2026-07-27')
    expect(notes[0].content).toContain('Fiz coisa X hoje')
  })

  test('ordena por data desc', async () => {
    await writeFile(join(tempDir, '2026-07-20.md'), '')
    await writeFile(join(tempDir, '2026-07-23.md'), '')
    await writeFile(join(tempDir, '2026-07-15.md'), '')
    const notes = await scanDailies(tempDir)
    expect(notes.map(n => n.date)).toEqual(['2026-07-23', '2026-07-20', '2026-07-15'])
  })
})

function makeDaily(date: string, consolidatedAt?: string): DailyNote {
  return {
    filename: `${date}.md`,
    filePath: `/x/${date}.md`,
    date,
    content: '',
    frontmatter: {},
    consolidatedAt,
  }
}

describe('bucketByWeek', () => {
  test('agrupa dailies em semanas ISO', () => {
    // Semana 2026-07-20 (seg) a 2026-07-26 (dom)
    // Semana 2026-07-13 a 2026-07-19
    const notes = [
      makeDaily('2026-07-23'), // seg semana 1
      makeDaily('2026-07-22'),
      makeDaily('2026-07-20'), // segunda
      makeDaily('2026-07-15'), // semana anterior
    ]
    const buckets = bucketByWeek(notes)
    expect(buckets).toHaveLength(2)
    expect(buckets[0].weekStart).toBe('2026-07-20')
    expect(buckets[0].weekEnd).toBe('2026-07-26')
    expect(buckets[0].dailies).toHaveLength(3)
    expect(buckets[1].weekStart).toBe('2026-07-13')
    expect(buckets[1].dailies).toHaveLength(1)
  })
})

describe('pickConsolidatableWeeks', () => {
  const now = new Date('2026-07-30T15:00:00Z') // quinta da semana 2026-07-27

  test('filtra semanas com < minDailies', () => {
    const buckets = [
      {
        weekStart: '2026-07-20',
        weekEnd: '2026-07-26',
        dailies: [makeDaily('2026-07-23'), makeDaily('2026-07-22')],
      },
    ]
    expect(pickConsolidatableWeeks(buckets, 3, now)).toHaveLength(0)
  })

  test('filtra semanas ja consolidadas', () => {
    const buckets = [
      {
        weekStart: '2026-07-20',
        weekEnd: '2026-07-26',
        dailies: [
          makeDaily('2026-07-23', '2026-07-27'), // ja consolidada
          makeDaily('2026-07-22'),
          makeDaily('2026-07-20'),
        ],
      },
    ]
    expect(pickConsolidatableWeeks(buckets, 3, now)).toHaveLength(0)
  })

  test('filtra semana corrente (nao consolida enquanto acontece)', () => {
    // now = 2026-07-30 quinta → semana atual = 2026-07-27
    const buckets = [
      {
        weekStart: '2026-07-27', // semana atual!
        weekEnd: '2026-08-02',
        dailies: [
          makeDaily('2026-07-27'),
          makeDaily('2026-07-28'),
          makeDaily('2026-07-29'),
        ],
      },
    ]
    expect(pickConsolidatableWeeks(buckets, 3, now)).toHaveLength(0)
  })

  test('aceita semana passada com >= minDailies e nenhuma consolidada', () => {
    const buckets = [
      {
        weekStart: '2026-07-20',
        weekEnd: '2026-07-26',
        dailies: [
          makeDaily('2026-07-23'),
          makeDaily('2026-07-22'),
          makeDaily('2026-07-20'),
        ],
      },
    ]
    expect(pickConsolidatableWeeks(buckets, 3, now)).toHaveLength(1)
  })
})
