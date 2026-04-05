/**
 * AndreClaw Update Checker
 *
 * Checks npm registry for newer versions and notifies the user on startup.
 * Caches the check result for 6 hours to avoid hammering npm on every launch.
 */

import { homedir } from 'os'
import { join } from 'path'

declare const MACRO: { VERSION: string; PACKAGE_URL: string }

interface UpdateCacheData {
  checkedAt: number
  latestVersion: string | null
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours
const CHECK_TIMEOUT_MS = 5000 // 5 seconds

function getCachePath(): string {
  return join(homedir(), '.andreclaw-update-cache.json')
}

function readCache(): UpdateCacheData | null {
  try {
    const fs = require('fs')
    const raw = fs.readFileSync(getCachePath(), 'utf8')
    const data = JSON.parse(raw) as UpdateCacheData
    if (data && typeof data.checkedAt === 'number' && Date.now() - data.checkedAt < CACHE_TTL_MS) {
      return data
    }
  } catch {
    // No cache or invalid — will re-check
  }
  return null
}

function writeCache(data: UpdateCacheData): void {
  try {
    const fs = require('fs')
    fs.writeFileSync(getCachePath(), JSON.stringify(data), 'utf8')
  } catch {
    // Non-critical — ignore write errors
  }
}

/**
 * Fetches the latest version from npm registry via HTTPS.
 * Does NOT use child_process (npm view) to keep it fast and lightweight.
 */
async function fetchLatestVersion(): Promise<string | null> {
  try {
    const packageName = 'andreclaw'
    const url = `https://registry.npmjs.org/${packageName}/latest`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      })

      if (!response.ok) return null

      const data = await response.json() as { version?: string }
      return data.version ?? null
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    return null
  }
}

/**
 * Compares two semver strings. Returns:
 *  -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number)
  const pb = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0
    const vb = pb[i] ?? 0
    if (va < vb) return -1
    if (va > vb) return 1
  }
  return 0
}

export interface UpdateCheckResult {
  updateAvailable: boolean
  currentVersion: string
  latestVersion: string | null
}

/**
 * Checks if a newer version of AndreClaw is available on npm.
 * Uses a local file cache to avoid checking on every startup.
 * This function is designed to be non-blocking and fail-safe.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = MACRO.VERSION

  // Try cache first
  const cached = readCache()
  if (cached) {
    return {
      updateAvailable: cached.latestVersion !== null && compareSemver(currentVersion, cached.latestVersion) < 0,
      currentVersion,
      latestVersion: cached.latestVersion,
    }
  }

  // Fetch from npm (non-blocking, with timeout)
  const latestVersion = await fetchLatestVersion()

  // Cache the result regardless of success
  writeCache({ checkedAt: Date.now(), latestVersion })

  return {
    updateAvailable: latestVersion !== null && compareSemver(currentVersion, latestVersion) < 0,
    currentVersion,
    latestVersion,
  }
}

/**
 * Prints an update notification banner to stdout.
 * Call this after the startup screen.
 */
export function printUpdateBanner(result: UpdateCheckResult): void {
  if (!result.updateAvailable || !result.latestVersion) return
  if (process.env.CI || !process.stdout.isTTY) return

  const ESC = '\x1b['
  const RESET = `${ESC}0m`
  const YELLOW = `${ESC}33m`
  const GREEN = `${ESC}32m`
  const BOLD = `${ESC}1m`
  const DIM = `${ESC}2m`

  const terminalWidth = process.stdout.columns || 80
  const boxWidth = 56
  const pad = ' '.repeat(Math.max(0, Math.floor((terminalWidth - boxWidth) / 2)))

  const lines = [
    '',
    `${pad}${YELLOW}${BOLD}  Nova versao disponivel!${RESET}`,
    `${pad}  ${DIM}Atual:${RESET}  v${result.currentVersion}`,
    `${pad}  ${GREEN}Nova:${RESET}   v${result.latestVersion}`,
    `${pad}  ${DIM}Rode:${RESET}   ${GREEN}npm install -g andreclaw@latest${RESET}`,
    '',
  ]

  process.stdout.write(lines.join('\n') + '\n')
}
