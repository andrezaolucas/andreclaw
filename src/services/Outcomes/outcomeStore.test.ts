import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import {
  computeStats,
  readOutcomes,
  recordOutcome,
} from './outcomeStore.js'
import type { OutcomeResult } from './types.js'

let origHome: string | undefined
let tempHome: string

beforeEach(async () => {
  origHome = process.env.HOME
  tempHome = join(tmpdir(), `andreclaw-outcomes-${Date.now()}-${Math.random()}`)
  await mkdir(tempHome, { recursive: true })
  process.env.HOME = tempHome
})

afterEach(async () => {
  if (origHome) process.env.HOME = origHome
  else delete process.env.HOME
  if (existsSync(tempHome)) {
    await rm(tempHome, { recursive: true, force: true })
  }
})

function makeResult(overrides: Partial<OutcomeResult> = {}): OutcomeResult {
  return {
    rubric: 'test-rubric',
    artifact: '/x.ts',
    passed: true,
    score: 0.85,
    criteria: [],
    failedCriteria: [],
    iterations: 1,
    durationMs: 100,
    feedback: 'ok',
    ...overrides,
  }
}

describe('outcomeStore', () => {
  test('readOutcomes vazio quando arquivo nao existe', async () => {
    expect(await readOutcomes()).toEqual([])
  })

  test('recordOutcome persiste + readOutcomes recupera', async () => {
    await recordOutcome(makeResult())
    const records = await readOutcomes()
    expect(records).toHaveLength(1)
    expect(records[0].rubric).toBe('test-rubric')
    expect(records[0].ts).toBeDefined()
  })

  test('multiplos records mantem ordem', async () => {
    await recordOutcome(makeResult({ rubric: 'a' }))
    await recordOutcome(makeResult({ rubric: 'b' }))
    await recordOutcome(makeResult({ rubric: 'c' }))
    const records = await readOutcomes()
    expect(records.map(r => r.rubric)).toEqual(['a', 'b', 'c'])
  })

  test('computeStats agrega por rubric', async () => {
    await recordOutcome(makeResult({ rubric: 'x', score: 0.9, passed: true }))
    await recordOutcome(makeResult({ rubric: 'x', score: 0.8, passed: true }))
    await recordOutcome(makeResult({ rubric: 'x', score: 0.4, passed: false }))
    await recordOutcome(makeResult({ rubric: 'y', score: 0.7, passed: true }))

    const stats = await computeStats()
    expect(stats).toHaveLength(2)
    const x = stats.find(s => s.rubric === 'x')!
    expect(x.runs).toBe(3)
    expect(x.passed).toBe(2)
    expect(x.passRate).toBeCloseTo(2 / 3, 5)
    expect(x.avgScore).toBeCloseTo(0.7, 5)
  })

  test('linha corrompida no jsonl e ignorada silenciosamente', async () => {
    await recordOutcome(makeResult({ rubric: 'valid' }))
    // Corrompe manualmente
    const outcomesFile = join(tempHome, '.andreclaw', 'outcomes', 'outcomes.jsonl')
    const fs = await import('fs/promises')
    await fs.appendFile(outcomesFile, 'lixo\n{invalid": ]\n', 'utf-8')
    const records = await readOutcomes()
    expect(records).toHaveLength(1)
    expect(records[0].rubric).toBe('valid')
  })
})
