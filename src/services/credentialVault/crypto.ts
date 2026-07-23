/**
 * AndreClaw Wave 5 (2026-07-23) — Envelope encryption AES-256-GCM.
 *
 * Design:
 * - Master key (32 bytes) do keychain/file
 * - HKDF-SHA256(master, salt_per_credential, info='andreclaw-vault-v1') = key derivada
 * - AES-256-GCM com IV 12 bytes random per encryption
 * - Auth tag 16 bytes anexado
 * - Base64 encoding pra JSON storage
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16
const SALT_LEN = 16
const KEY_LEN = 32
const HKDF_INFO = 'andreclaw-vault-v1'

function deriveKey(master: Buffer, salt: Buffer): Buffer {
  const derived = hkdfSync('sha256', master, salt, HKDF_INFO, KEY_LEN)
  return Buffer.from(derived)
}

export type EncryptedEnvelope = {
  iv: string // base64
  ciphertext: string // base64
  authTag: string // base64
  salt: string // base64
}

export function encrypt(plaintext: string, master: Buffer): EncryptedEnvelope {
  const salt = randomBytes(SALT_LEN)
  const key = deriveKey(master, salt)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf-8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  if (authTag.length !== TAG_LEN) {
    throw new Error(`auth tag length inesperado: ${authTag.length}`)
  }
  return {
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    authTag: authTag.toString('base64'),
    salt: salt.toString('base64'),
  }
}

export function decrypt(envelope: EncryptedEnvelope, master: Buffer): string {
  const iv = Buffer.from(envelope.iv, 'base64')
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64')
  const authTag = Buffer.from(envelope.authTag, 'base64')
  const salt = Buffer.from(envelope.salt, 'base64')

  if (iv.length !== IV_LEN) throw new Error(`iv len ${iv.length}`)
  if (authTag.length !== TAG_LEN) throw new Error(`tag len ${authTag.length}`)
  if (salt.length !== SALT_LEN) throw new Error(`salt len ${salt.length}`)

  const key = deriveKey(master, salt)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])
  return decrypted.toString('utf-8')
}

/**
 * Gera hint sem revelar o valor. Ex: "sk-abc***xyz9".
 */
export function makeHint(value: string): string {
  if (value.length <= 8) return '***'
  return `${value.slice(0, 6)}***${value.slice(-4)}`
}
