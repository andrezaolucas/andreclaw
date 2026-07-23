/**
 * AndreClaw Wave 4 (2026-07-23) — Vault Dream types.
 */

export type VaultDreamConfig = {
  enabled: boolean
  vaultPath: string
  dailyFolder: string
  memoryFolder: string
  cron: string
  minDailies: number
}

export type DailyNote = {
  filename: string // ex: "2026-07-15.md"
  filePath: string
  date: string // ISO YYYY-MM-DD
  content: string
  frontmatter: Record<string, unknown>
  consolidatedAt?: string // se ja foi consolidada
}

export type WeekBucket = {
  weekStart: string // ISO YYYY-MM-DD da segunda
  weekEnd: string // ISO YYYY-MM-DD do domingo
  dailies: DailyNote[]
}

export type VaultDreamResult = {
  weekStart: string
  weekEnd: string
  dailiesConsolidated: number
  summaryPath: string
  skipped: boolean
  skipReason?: string
}
