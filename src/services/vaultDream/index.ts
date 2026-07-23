/**
 * AndreClaw Wave 4 (2026-07-23) — Vault Dream barrel + entrypoint.
 */

export type {
  DailyNote,
  VaultDreamConfig,
  VaultDreamResult,
  WeekBucket,
} from './types.js'

export { getVaultDreamConfig } from './config.js'
export {
  bucketByWeek,
  pickConsolidatableWeeks,
  scanDailies,
} from './dailyScanner.js'
export {
  endOfWeek,
  extractDateFromFilename,
  parseIsoDate,
  startOfWeek,
  toIsoDate,
} from './dateHelpers.js'

/**
 * Kill switch.
 */
export function isVaultDreamEnabled(): boolean {
  if (process.env.ANDRECLAW_VAULT_DREAM === 'off') return false
  // Sem consulta a config aqui pra evitar side effects em imports frios
  return true
}
