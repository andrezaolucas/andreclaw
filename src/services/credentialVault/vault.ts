/**
 * AndreClaw Wave 5 (2026-07-23) — Credential vault API.
 *
 * Storage: ~/.andreclaw/credentials.enc (JSON, mode 0600).
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { chmod, mkdir } from 'fs/promises'
import { homedir } from 'os'
import { dirname, join } from 'path'

import { decrypt, encrypt, makeHint } from './crypto.js'
import { getMasterKey } from './masterKey.js'
import type {
  CredentialMeta,
  EncryptedCredential,
  ProviderId,
  VaultFile,
} from './types.js'

const VAULT_VERSION = 1

function resolveHome(): string {
  return process.env.HOME ?? homedir()
}

function getVaultPath(): string {
  return join(resolveHome(), '.andreclaw', 'credentials.enc')
}

async function ensureVaultDir(): Promise<void> {
  const dir = dirname(getVaultPath())
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
}

function readVaultFile(): VaultFile {
  const path = getVaultPath()
  if (!existsSync(path)) {
    return { version: VAULT_VERSION, credentials: [] }
  }
  try {
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw) as VaultFile
    if (parsed.version !== VAULT_VERSION) {
      // Schema mismatch — reset silencioso
      return { version: VAULT_VERSION, credentials: [] }
    }
    return parsed
  } catch {
    return { version: VAULT_VERSION, credentials: [] }
  }
}

async function writeVaultFile(vault: VaultFile): Promise<void> {
  await ensureVaultDir()
  const path = getVaultPath()
  writeFileSync(path, JSON.stringify(vault, null, 2), { mode: 0o600 })
  await chmod(path, 0o600).catch(() => {})
}

/**
 * Salva API key criptografada. Sobrescreve se ja existir.
 */
export async function set(provider: ProviderId, value: string): Promise<void> {
  if (!value || value.trim().length < 8) {
    throw new Error(`API key para ${provider} muito curta ou vazia`)
  }
  const master = await getMasterKey()
  const envelope = encrypt(value, master)
  const vault = readVaultFile()
  vault.credentials = vault.credentials.filter(c => c.provider !== provider)
  const entry: EncryptedCredential = {
    provider,
    addedAt: new Date().toISOString(),
    hint: makeHint(value),
    ...envelope,
  }
  vault.credentials.push(entry)
  await writeVaultFile(vault)
}

/**
 * Le API key. Retorna undefined se nao existir. Atualiza lastUsedAt.
 * Precedencia: env var especifica > vault > undefined.
 */
export async function get(provider: ProviderId): Promise<string | undefined> {
  // Env var especifica sempre vence (compat legada)
  const envVar = envVarForProvider(provider)
  if (envVar && process.env[envVar]) {
    return process.env[envVar]
  }

  const vault = readVaultFile()
  const entry = vault.credentials.find(c => c.provider === provider)
  if (!entry) return undefined

  try {
    const master = await getMasterKey()
    const value = decrypt(entry, master)

    // Atualiza lastUsedAt (async, nao bloqueia leitura)
    void updateLastUsed(provider).catch(() => {})

    return value
  } catch {
    return undefined
  }
}

async function updateLastUsed(provider: ProviderId): Promise<void> {
  const vault = readVaultFile()
  const entry = vault.credentials.find(c => c.provider === provider)
  if (!entry) return
  entry.lastUsedAt = new Date().toISOString()
  await writeVaultFile(vault)
}

/**
 * Remove credential. Idempotente (nao lanca se nao existir).
 */
export async function remove(provider: ProviderId): Promise<boolean> {
  const vault = readVaultFile()
  const before = vault.credentials.length
  vault.credentials = vault.credentials.filter(c => c.provider !== provider)
  if (vault.credentials.length !== before) {
    await writeVaultFile(vault)
    return true
  }
  return false
}

/**
 * Lista providers autenticados (metadata pura, sem valores).
 */
export function list(): CredentialMeta[] {
  const vault = readVaultFile()
  return vault.credentials.map(c => ({
    provider: c.provider,
    addedAt: c.addedAt,
    lastUsedAt: c.lastUsedAt,
    hint: c.hint,
  }))
}

/**
 * Env var equivalente pra cada provider (compat com CLIs existentes).
 */
export function envVarForProvider(provider: ProviderId): string | undefined {
  switch (provider) {
    case 'openai':
      return 'OPENAI_API_KEY'
    case 'deepseek':
      return 'DEEPSEEK_API_KEY'
    case 'gemini':
      return 'GEMINI_API_KEY'
    case 'groq':
      return 'GROQ_API_KEY'
    case 'openrouter':
      return 'OPENROUTER_API_KEY'
    case 'anthropic-key':
      return 'ANTHROPIC_API_KEY'
  }
}
