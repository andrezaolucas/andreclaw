/**
 * AndreClaw Wave 4 (2026-07-23) — Scanner de daily notes do vault.
 */

import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

import {
  endOfWeek,
  extractDateFromFilename,
  startOfWeek,
  toIsoDate,
} from './dateHelpers.js'
import type { DailyNote, WeekBucket } from './types.js'

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/

/**
 * Le todas as daily notes da pasta configurada.
 * Retorna sorted por data desc.
 */
export async function scanDailies(dailyDir: string): Promise<DailyNote[]> {
  let entries: string[]
  try {
    entries = await readdir(dailyDir)
  } catch {
    return []
  }

  const mdFiles = entries.filter(f => f.endsWith('.md'))
  const notes: DailyNote[] = []

  for (const filename of mdFiles) {
    const date = extractDateFromFilename(filename)
    if (!date) continue

    const filePath = join(dailyDir, filename)
    try {
      const raw = await readFile(filePath, 'utf-8')
      const { frontmatter, body } = parseFrontmatter(raw)
      notes.push({
        filename,
        filePath,
        date: toIsoDate(date),
        content: body,
        frontmatter,
        consolidatedAt:
          typeof frontmatter.consolidatedAt === 'string'
            ? frontmatter.consolidatedAt
            : undefined,
      })
    } catch {
      // arquivo ilegivel — pula
    }
  }

  return notes.sort((a, b) => (a.date < b.date ? 1 : -1))
}

/**
 * Agrupa daily notes pela semana ISO (segunda a domingo).
 * Retorna sorted por weekStart desc.
 */
export function bucketByWeek(notes: readonly DailyNote[]): WeekBucket[] {
  const buckets = new Map<string, WeekBucket>()
  for (const note of notes) {
    const date = new Date(note.date + 'T00:00:00Z')
    const weekStart = toIsoDate(startOfWeek(date))
    const weekEnd = toIsoDate(endOfWeek(date))
    let bucket = buckets.get(weekStart)
    if (!bucket) {
      bucket = { weekStart, weekEnd, dailies: [] }
      buckets.set(weekStart, bucket)
    }
    bucket.dailies.push(note)
  }
  return Array.from(buckets.values()).sort((a, b) =>
    a.weekStart < b.weekStart ? 1 : -1,
  )
}

/**
 * Filtra semanas elegiveis pra consolidacao:
 * - >= minDailies notas
 * - todas nao consolidadas ainda
 * - semana ja terminou (nao consolida a semana corrente)
 */
export function pickConsolidatableWeeks(
  buckets: readonly WeekBucket[],
  minDailies: number,
  now: Date = new Date(),
): WeekBucket[] {
  const nowStart = startOfWeek(now)
  return buckets.filter(b => {
    if (b.dailies.length < minDailies) return false
    if (b.dailies.some(d => d.consolidatedAt)) return false
    const weekStartDate = new Date(b.weekStart + 'T00:00:00Z')
    // Nao consolidar semana corrente (>= inicio da semana atual)
    if (weekStartDate.getTime() >= nowStart.getTime()) return false
    return true
  })
}

function parseFrontmatter(raw: string): {
  frontmatter: Record<string, unknown>
  body: string
} {
  const m = FRONTMATTER_RE.exec(raw)
  if (!m) return { frontmatter: {}, body: raw }
  const [, frontRaw, body] = m
  const frontmatter: Record<string, unknown> = {}
  for (const line of frontRaw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf(':')
    if (idx < 0) continue
    const key = trimmed.slice(0, idx).trim()
    let val: string = trimmed.slice(idx + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    frontmatter[key] = val
  }
  return { frontmatter, body }
}
