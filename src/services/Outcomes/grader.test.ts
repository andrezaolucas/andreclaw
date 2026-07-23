import { describe, expect, test } from 'bun:test'

import { grade, runOutcomeGrader, type CriterionEvaluator } from './grader.js'
import type { Rubric } from './types.js'

const controller = new AbortController()

function makeRubric(overrides: Partial<Rubric> = {}): Rubric {
  return {
    name: 'test',
    threshold: 0.7,
    maxIterations: 3,
    criteria: [
      { name: 'a', weight: 1, checks: ['check1'] },
      { name: 'b', weight: 2, checks: ['check2'] },
    ],
    ...overrides,
  }
}

describe('grade — logica pura', () => {
  test('passa quando todos criterios passam com score alto', async () => {
    const evaluator: CriterionEvaluator = async () => ({ passed: true, score: 0.9 })
    const r = await grade({
      rubric: makeRubric(),
      artifactPath: '/x.ts',
      artifact: 'code',
      evaluator,
      signal: controller.signal,
    })
    expect(r.passed).toBe(true)
    expect(r.score).toBeCloseTo(0.9, 5)
    expect(r.failedCriteria).toHaveLength(0)
  })

  test('falha quando qualquer criterio falha (mesmo score alto)', async () => {
    const evaluator: CriterionEvaluator = async ({ criterionName }) => ({
      passed: criterionName !== 'b',
      score: criterionName === 'b' ? 0.5 : 0.9,
    })
    const r = await grade({
      rubric: makeRubric(),
      artifactPath: '/x.ts',
      artifact: 'code',
      evaluator,
      signal: controller.signal,
    })
    expect(r.passed).toBe(false)
    expect(r.failedCriteria.map(c => c.name)).toEqual(['b'])
  })

  test('weighted score respeita pesos', async () => {
    // criterio a (peso 1, score 1.0) + b (peso 2, score 0.4)
    // weighted = (1*1 + 2*0.4) / 3 = 1.8/3 = 0.6
    const evaluator: CriterionEvaluator = async ({ criterionName }) => ({
      passed: true,
      score: criterionName === 'a' ? 1 : 0.4,
    })
    const r = await grade({
      rubric: makeRubric(),
      artifactPath: '/x.ts',
      artifact: 'code',
      evaluator,
      signal: controller.signal,
    })
    expect(r.score).toBeCloseTo(0.6, 5)
    // 0.6 < 0.7 threshold → falha mesmo tudo "passed"
    expect(r.passed).toBe(false)
  })

  test('score clampado 0..1', async () => {
    const evaluator: CriterionEvaluator = async () => ({ passed: true, score: 999 })
    const r = await grade({
      rubric: makeRubric(),
      artifactPath: '/x.ts',
      artifact: 'code',
      evaluator,
      signal: controller.signal,
    })
    expect(r.score).toBe(1)
  })

  test('evaluator throw = criterio falha com reason', async () => {
    const evaluator: CriterionEvaluator = async () => {
      throw new Error('LLM offline')
    }
    const r = await grade({
      rubric: makeRubric({ criteria: [{ name: 'x', weight: 1, checks: ['c'] }] }),
      artifactPath: '/x.ts',
      artifact: 'code',
      evaluator,
      signal: controller.signal,
    })
    expect(r.passed).toBe(false)
    expect(r.criteria[0].reason).toContain('LLM offline')
  })

  test('feedback contem lista de criterios falhados', async () => {
    const evaluator: CriterionEvaluator = async () => ({
      passed: false,
      score: 0.3,
      reason: 'nao passou porque X',
    })
    const r = await grade({
      rubric: makeRubric(),
      artifactPath: '/x.ts',
      artifact: 'code',
      evaluator,
      signal: controller.signal,
    })
    expect(r.feedback).toContain('a')
    expect(r.feedback).toContain('b')
    expect(r.feedback).toContain('nao passou porque X')
  })
})

describe('runOutcomeGrader', () => {
  test('retorna OutcomeResult completo', async () => {
    const evaluator: CriterionEvaluator = async () => ({ passed: true, score: 0.85 })
    const result = await runOutcomeGrader({
      rubric: makeRubric(),
      artifactPath: '/foo.ts',
      artifact: 'x',
      evaluator,
      signal: controller.signal,
    })
    expect(result.rubric).toBe('test')
    expect(result.artifact).toBe('/foo.ts')
    expect(result.passed).toBe(true)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.iterations).toBe(1)
  })
})
