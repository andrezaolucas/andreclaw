/**
 * AndreClaw Wave 4 (2026-07-23) — Parser de rubric markdown.
 *
 * Formato:
 * ---
 * name: string (required)
 * threshold: number 0..1 (default 0.7)
 * max_iterations: integer (default 3)
 * ---
 *
 * ## Criterios
 *
 * ### <nome> (peso: N)
 * - checklist 1
 * - checklist 2
 *
 * ### <nome2>
 * - checklist 1
 */

import { readFile } from 'fs/promises'

import type { Criterion, Rubric } from './types.js'

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/
const CRITERION_HEADING_RE = /^###\s+(.+?)(?:\s*\(peso:\s*(\d+(?:\.\d+)?)\))?\s*$/
const CHECKLIST_RE = /^\s*[-*]\s+(.+)$/

export async function parseRubricFile(path: string): Promise<Rubric> {
  const raw = await readFile(path, 'utf-8')
  return parseRubric(raw, path)
}

export function parseRubric(raw: string, sourcePath?: string): Rubric {
  const m = FRONTMATTER_RE.exec(raw)
  if (!m) {
    throw new Error(
      `Rubric${sourcePath ? ` em ${sourcePath}` : ''} sem frontmatter YAML valido`,
    )
  }
  const [, frontRaw, body] = m
  const front = parseSimpleYaml(frontRaw)

  const name = String(front.name ?? '').trim()
  if (!name) {
    throw new Error(`Rubric${sourcePath ? ` em ${sourcePath}` : ''} sem "name" no frontmatter`)
  }

  const threshold = clampNumber(front.threshold, 0, 1, 0.7)
  const maxIterations = Math.max(1, Math.floor(Number(front.max_iterations ?? 3)))

  const criteria = parseCriteria(body)
  if (criteria.length === 0) {
    throw new Error(
      `Rubric${sourcePath ? ` em ${sourcePath}` : ''} sem criterios (esperado "### <nome>" com checklist)`,
    )
  }

  return { name, threshold, maxIterations, criteria }
}

/**
 * YAML parser minimo — so o suficiente pra frontmatter simples key: value.
 * Nao lida com nested, listas ou tipos complexos.
 */
function parseSimpleYaml(raw: string): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf(':')
    if (idx < 0) continue
    const key = trimmed.slice(0, idx).trim()
    let val: string = trimmed.slice(idx + 1).trim()
    // Remove quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    // Coerce number se possivel
    const asNum = Number(val)
    out[key] = !Number.isNaN(asNum) && val !== '' ? asNum : val
  }
  return out
}

function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function parseCriteria(body: string): Criterion[] {
  const lines = body.split('\n')
  const criteria: Criterion[] = []
  let current: Criterion | null = null

  for (const line of lines) {
    const heading = CRITERION_HEADING_RE.exec(line)
    if (heading) {
      if (current) criteria.push(current)
      current = {
        name: heading[1].trim(),
        weight: heading[2] ? Number(heading[2]) : 1,
        checks: [],
      }
      continue
    }
    if (current) {
      const check = CHECKLIST_RE.exec(line)
      if (check) {
        current.checks.push(check[1].trim())
      }
    }
  }
  if (current) criteria.push(current)
  return criteria.filter(c => c.checks.length > 0)
}
