/**
 * AgentShield-lite / Config loader
 *
 * Carrega perfil de seguranca de `~/.andreclaw/security.json` + env var
 * `ANDRECLAW_SECURITY_PROFILE`. Env var vence config file.
 */

import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

import type { SecurityProfile } from './dangerousCommands.js'

const VALID_PROFILES: readonly SecurityProfile[] = [
  'minimal',
  'standard',
  'strict',
]

let cachedProfile: SecurityProfile | null = null

function isValidProfile(v: unknown): v is SecurityProfile {
  return typeof v === 'string' && (VALID_PROFILES as readonly string[]).includes(v)
}

/**
 * Retorna perfil ativo. Cacheia por processo.
 * Ordem de precedencia:
 * 1. env `ANDRECLAW_SECURITY_PROFILE`
 * 2. `~/.andreclaw/security.json` → `{ "profile": "..." }`
 * 3. default: 'standard'
 */
export function getSecurityProfile(): SecurityProfile {
  if (cachedProfile !== null) return cachedProfile

  const envVal = process.env.ANDRECLAW_SECURITY_PROFILE
  if (isValidProfile(envVal)) {
    cachedProfile = envVal
    return cachedProfile
  }

  const configPath = join(homedir(), '.andreclaw', 'security.json')
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(raw) as { profile?: unknown }
      if (isValidProfile(parsed.profile)) {
        cachedProfile = parsed.profile
        return cachedProfile
      }
    } catch {
      // Ignorar erros de parse — cai no default
    }
  }

  cachedProfile = 'standard'
  return cachedProfile
}

/**
 * Reseta cache (util em testes).
 */
export function _resetSecurityConfigCache(): void {
  cachedProfile = null
}

/**
 * Verifica se um recurso especifico esta desabilitado via env.
 * Ex: ANDRECLAW_SECURITY_DISABLED=secret-detection,config-protection
 */
export function isSecurityFeatureDisabled(
  feature: 'dangerous-commands' | 'secret-detection' | 'config-protection',
): boolean {
  const disabled = process.env.ANDRECLAW_SECURITY_DISABLED
  if (!disabled) return false
  return disabled
    .split(',')
    .map(s => s.trim().toLowerCase())
    .includes(feature)
}
