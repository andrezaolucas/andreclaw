/**
 * AndreClaw Wave 4 (2026-07-23) — Outcomes framework barrel.
 */

export type {
  Criterion,
  CriterionResult,
  OutcomeRecord,
  OutcomeResult,
  Rubric,
} from './types.js'

export { parseRubric, parseRubricFile } from './rubricParser.js'
export {
  type CriterionEvaluator,
  grade,
  runOutcomeGrader,
} from './grader.js'
export {
  type OutcomeStats,
  computeStats,
  readOutcomes,
  recordOutcome,
} from './outcomeStore.js'

/**
 * Kill switch — respeitado por callers integrating with the main loop.
 */
export function isOutcomesEnabled(): boolean {
  return process.env.ANDRECLAW_OUTCOMES !== 'off'
}
