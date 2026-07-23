/**
 * AndreClaw Wave 4 (2026-07-23) — Persistent outcomes log.
 *
 * Storage: `~/.andreclaw/outcomes/outcomes.jsonl` (append-only).
 * Cada linha: OutcomeRecord.
 *
 * Design match indexStore da Wave 3 — append-only, sem locks.
 */

import { appendFile, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

import type { OutcomeRecord, OutcomeResult } from './types.js'

function resolveHome(): string {
  return process.env.HOME ?? homedir()
}

function getOutcomesDir(): string {
  return join(resolveHome(), '.andreclaw', 'outcomes')
}

function getOutcomesFile(): string {
  return join(getOutcomesDir(), 'outcomes.jsonl')
}

async function ensureDir(): Promise<void> {
  const dir = getOutcomesDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

/**
 * Append um outcome record no log.
 */
export async function recordOutcome(result: OutcomeResult): Promise<void> {
  await ensureDir()
  const record: OutcomeRecord = {
    ...result,
    ts: new Date().toISOString(),
  }
  await appendFile(getOutcomesFile(), JSON.stringify(record) + '\n', 'utf-8')
}

/**
 * Le todos os records do log. Util pra CLI de stats.
 */
export async function readOutcomes(): Promise<OutcomeRecord[]> {
  try {
    const raw = await readFile(getOutcomesFile(), 'utf-8')
    const records: OutcomeRecord[] = []
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        records.push(JSON.parse(line) as OutcomeRecord)
      } catch {
        // linha corrompida — ignora
      }
    }
    return records
  } catch {
    return []
  }
}

/**
 * Estatisticas simples por rubric — pass rate, score medio, iteracoes media.
 */
export type OutcomeStats = {
  rubric: string
  runs: number
  passed: number
  passRate: number
  avgScore: number
  avgIterations: number
  avgDurationMs: number
}

export async function computeStats(): Promise<OutcomeStats[]> {
  const records = await readOutcomes()
  const byRubric = new Map<string, OutcomeRecord[]>()
  for (const r of records) {
    const list = byRubric.get(r.rubric) ?? []
    list.push(r)
    byRubric.set(r.rubric, list)
  }
  const stats: OutcomeStats[] = []
  for (const [rubric, runs] of byRubric) {
    const passed = runs.filter(r => r.passed).length
    stats.push({
      rubric,
      runs: runs.length,
      passed,
      passRate: passed / runs.length,
      avgScore: mean(runs.map(r => r.score)),
      avgIterations: mean(runs.map(r => r.iterations)),
      avgDurationMs: mean(runs.map(r => r.durationMs)),
    })
  }
  return stats.sort((a, b) => b.runs - a.runs)
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}
