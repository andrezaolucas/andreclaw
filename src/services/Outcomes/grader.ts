/**
 * AndreClaw Wave 4 (2026-07-23) — Outcome grader.
 *
 * Puro sem dependencia do stack de LLM — recebe um `evaluator` como
 * parametro. Isso permite:
 * - Testar a logica sem chamar API real (mock evaluator)
 * - Trocar entre providers (Sonnet, Ollama local, custom)
 *
 * O `runOutcome` (arquivo separado) integra com `sideQuery`/Sonnet do AndreClaw.
 */

import type {
  CriterionResult,
  OutcomeResult,
  Rubric,
} from './types.js'

/**
 * Assinatura do avaliador. Recebe conteudo do artefato + criterio, retorna
 * { passed, score, reason }.
 */
export type CriterionEvaluator = (params: {
  artifact: string
  artifactPath: string
  criterionName: string
  criterionChecks: string[]
  signal: AbortSignal
}) => Promise<{ passed: boolean; score: number; reason?: string }>

export type GradeParams = {
  rubric: Rubric
  artifactPath: string
  artifact: string
  evaluator: CriterionEvaluator
  signal: AbortSignal
}

/**
 * Avalia um artefato contra uma rubric. Chama o evaluator uma vez por
 * criterio em paralelo (bounded a 3 pra nao overload).
 *
 * Score final = weighted average por peso do criterio.
 * Passed = score >= threshold E todos criterios passaram.
 */
export async function grade(params: GradeParams): Promise<{
  passed: boolean
  score: number
  criteria: CriterionResult[]
  failedCriteria: CriterionResult[]
  feedback: string
}> {
  const { rubric, artifact, artifactPath, evaluator, signal } = params

  const CONCURRENCY = 3
  const results: CriterionResult[] = new Array(rubric.criteria.length)
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < rubric.criteria.length) {
      const i = cursor++
      const c = rubric.criteria[i]
      try {
        const res = await evaluator({
          artifact,
          artifactPath,
          criterionName: c.name,
          criterionChecks: c.checks,
          signal,
        })
        results[i] = {
          name: c.name,
          weight: c.weight,
          passed: res.passed,
          score: clamp(res.score, 0, 1),
          reason: res.reason,
        }
      } catch (e) {
        results[i] = {
          name: c.name,
          weight: c.weight,
          passed: false,
          score: 0,
          reason: `evaluator error: ${e instanceof Error ? e.message : String(e)}`,
        }
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  const totalWeight = results.reduce((s, r) => s + r.weight, 0) || 1
  const weightedScore =
    results.reduce((s, r) => s + r.score * r.weight, 0) / totalWeight

  const failedCriteria = results.filter(r => !r.passed)
  const passed = weightedScore >= rubric.threshold && failedCriteria.length === 0

  const feedback = failedCriteria.length === 0
    ? `Passou todos os ${results.length} criterios (score ${weightedScore.toFixed(2)}).`
    : `Falhou em: ${failedCriteria.map(c => `${c.name}${c.reason ? ' (' + c.reason + ')' : ''}`).join('; ')}`

  return {
    passed,
    score: weightedScore,
    criteria: results,
    failedCriteria,
    feedback,
  }
}

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min
  return Math.min(max, Math.max(min, v))
}

/**
 * Executa uma rubric contra um artefato com loop de refinamento.
 *
 * Nao chama refinar automaticamente — devolve o resultado. Caller
 * (agente main loop) decide se re-executa a task com feedback.
 */
export async function runOutcomeGrader(params: {
  rubric: Rubric
  artifactPath: string
  artifact: string
  evaluator: CriterionEvaluator
  signal: AbortSignal
  iterations?: number
}): Promise<OutcomeResult> {
  const start = Date.now()
  const iterations = params.iterations ?? 1
  const gradeResult = await grade(params)
  return {
    rubric: params.rubric.name,
    artifact: params.artifactPath,
    passed: gradeResult.passed,
    score: gradeResult.score,
    criteria: gradeResult.criteria,
    failedCriteria: gradeResult.failedCriteria,
    iterations,
    durationMs: Date.now() - start,
    feedback: gradeResult.feedback,
  }
}
