/**
 * AndreClaw Wave 5 (2026-07-23) — Credential vault types.
 */

export type ProviderId =
  | 'openai'
  | 'deepseek'
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'anthropic-key'

export const SUPPORTED_PROVIDERS: readonly ProviderId[] = [
  'openai',
  'deepseek',
  'gemini',
  'groq',
  'openrouter',
  'anthropic-key',
]

/**
 * Metadata publica de um credential — nao revela o valor.
 */
export type CredentialMeta = {
  provider: ProviderId
  addedAt: string // ISO
  lastUsedAt?: string // ISO
  hint?: string // ex: "sk-abc***xyz" (primeiros 6 + '***' + ultimos 4)
}

/**
 * Envelope encriptado gravado em disco (sem valor plain).
 */
export type EncryptedCredential = CredentialMeta & {
  iv: string // base64
  ciphertext: string // base64
  authTag: string // base64
  salt: string // base64 (HKDF salt)
}

export type VaultFile = {
  version: 1
  credentials: EncryptedCredential[]
}

export type ValidateResult = {
  valid: boolean
  reason?: string
  detectedModels?: string[]
}
