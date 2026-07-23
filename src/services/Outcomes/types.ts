/**
 * AndreClaw Wave 4 (2026-07-23) — Outcomes framework types.
 */

export type Criterion = {
  name: string
  weight: number // pesos relativos entre criterios de uma rubric
  checks: string[] // linhas de checklist markdown
}

export type Rubric = {
  name: string
  threshold: number // 0..1, minimo pra passar
  maxIterations: number
  criteria: Criterion[]
}

export type CriterionResult = {
  name: string
  weight: number
  passed: boolean
  score: number // 0..1
  reason?: string
}

export type OutcomeResult = {
  rubric: string
  artifact: string
  passed: boolean
  score: number // weighted avg de criteria
  criteria: CriterionResult[]
  failedCriteria: CriterionResult[]
  iterations: number
  durationMs: number
  feedback: string
}

export type OutcomeRecord = OutcomeResult & {
  ts: string // ISO timestamp
}
