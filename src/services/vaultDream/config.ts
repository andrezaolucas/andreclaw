/**
 * AndreClaw Wave 4 (2026-07-23) — Vault Dream config loader.
 *
 * Ordem de precedencia:
 * 1. env `ANDRECLAW_VAULT_DREAM=off` desliga totalmente
 * 2. env `ANDRECLAW_VAULT_PATH` / `ANDRECLAW_VAULT_DREAM_CRON` overrides
 * 3. `~/.andreclaw/settings.json` → `vaultDream: { ... }`
 * 4. defaults
 */

import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

import type { VaultDreamConfig } from './types.js'

const DEFAULTS: VaultDreamConfig = {
  enabled: false, // opt-in explicito — nao roda sem config
  vaultPath: '',
  dailyFolder: 'Daily',
  memoryFolder: '_memory',
  cron: '0 22 * * 0', // domingo 22h
  minDailies: 3,
}

function resolveHome(): string {
  return process.env.HOME ?? homedir()
}

function readSettingsFile(): Partial<VaultDreamConfig> {
  const path = join(resolveHome(), '.andreclaw', 'settings.json')
  if (!existsSync(path)) return {}
  try {
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw) as { vaultDream?: Partial<VaultDreamConfig> }
    return parsed.vaultDream ?? {}
  } catch {
    return {}
  }
}

export function getVaultDreamConfig(): VaultDreamConfig {
  if (process.env.ANDRECLAW_VAULT_DREAM === 'off') {
    return { ...DEFAULTS, enabled: false }
  }

  const fromFile = readSettingsFile()
  const config: VaultDreamConfig = {
    ...DEFAULTS,
    ...fromFile,
  }

  // Env overrides finais
  if (process.env.ANDRECLAW_VAULT_PATH) {
    config.vaultPath = process.env.ANDRECLAW_VAULT_PATH
  }
  if (process.env.ANDRECLAW_VAULT_DREAM_CRON) {
    config.cron = process.env.ANDRECLAW_VAULT_DREAM_CRON
  }
  if (process.env.ANDRECLAW_VAULT_DREAM === 'on') {
    config.enabled = true
  }

  // Requer vaultPath valido pra ser realmente enabled
  if (!config.vaultPath) {
    config.enabled = false
  }

  return config
}
