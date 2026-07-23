/**
 * AndreClaw Wave 5 (2026-07-23) — Credential vault barrel.
 */

export type {
  CredentialMeta,
  EncryptedCredential,
  ProviderId,
  ValidateResult,
  VaultFile,
} from './types.js'
export { SUPPORTED_PROVIDERS } from './types.js'

export {
  envVarForProvider,
  get,
  list,
  remove,
  set,
} from './vault.js'

export { validate } from './validator.js'

export {
  _resetMasterKeyCache,
  getMasterKey,
  getMasterKeyLocation,
} from './masterKey.js'

export type { EncryptedEnvelope } from './crypto.js'
export { decrypt, encrypt, makeHint } from './crypto.js'
