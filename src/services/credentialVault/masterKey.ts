/**
 * AndreClaw Wave 5 (2026-07-23) — Master key manager.
 *
 * macOS: usa `security` CLI (builtin) pra armazenar no Keychain.
 * Linux/Windows: fallback pra file 0600 em ~/.andreclaw/.master-key
 *
 * Master key = 32 bytes random. Usada como IKM pro HKDF-SHA256 por credential.
 */

import { spawn } from 'child_process'
import { randomBytes } from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { chmod, mkdir } from 'fs/promises'
import { homedir } from 'os'
import { dirname, join } from 'path'

const SERVICE_NAME = 'andreclaw-vault'
const ACCOUNT_NAME = 'master-key'

function resolveHome(): string {
  return process.env.HOME ?? homedir()
}

function getKeyFilePath(): string {
  return join(resolveHome(), '.andreclaw', '.master-key')
}

/**
 * Executa `security` CLI (macOS). Retorna stdout ou throw.
 */
function runSecurity(args: string[], stdin?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('security', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', d => (stdout += d.toString()))
    proc.stderr.on('data', d => (stderr += d.toString()))
    proc.on('close', code => {
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(`security exit ${code}: ${stderr.trim()}`))
    })
    if (stdin) proc.stdin.write(stdin)
    proc.stdin.end()
  })
}

/**
 * Tenta pegar master key do Keychain. Retorna undefined se nao existe ou erro.
 *
 * Testes forcam file-based via `ANDRECLAW_VAULT_NO_KEYCHAIN=1`.
 */
async function tryReadKeychainKey(): Promise<Buffer | undefined> {
  if (process.platform !== 'darwin') return undefined
  if (process.env.ANDRECLAW_VAULT_NO_KEYCHAIN === '1') return undefined
  try {
    const out = await runSecurity([
      'find-generic-password',
      '-s', SERVICE_NAME,
      '-a', ACCOUNT_NAME,
      '-w',
    ])
    if (!out) return undefined
    return Buffer.from(out, 'base64')
  } catch {
    return undefined
  }
}

/**
 * Cria master key no Keychain. Idempotente — sobrescreve se existir.
 */
async function writeKeychainKey(key: Buffer): Promise<void> {
  const encoded = key.toString('base64')
  // -U = update se ja existe
  await runSecurity([
    'add-generic-password',
    '-U',
    '-s', SERVICE_NAME,
    '-a', ACCOUNT_NAME,
    '-w', encoded,
  ])
}

/**
 * Fallback file-based (Linux/Windows).
 */
function readFileKey(): Buffer | undefined {
  const path = getKeyFilePath()
  if (!existsSync(path)) return undefined
  try {
    return Buffer.from(readFileSync(path, 'utf-8').trim(), 'base64')
  } catch {
    return undefined
  }
}

async function writeFileKey(key: Buffer): Promise<void> {
  const path = getKeyFilePath()
  const dir = dirname(path)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  writeFileSync(path, key.toString('base64'), { mode: 0o600 })
  // Garante mode mesmo se ja existia
  await chmod(path, 0o600).catch(() => {})
}

let cachedKey: Buffer | null = null

/**
 * Retorna master key, criando se nao existir.
 * Cacheia por processo.
 */
export async function getMasterKey(): Promise<Buffer> {
  if (cachedKey) return cachedKey

  // Tenta Keychain primeiro (macOS)
  const keychainKey = await tryReadKeychainKey()
  if (keychainKey && keychainKey.length === 32) {
    cachedKey = keychainKey
    return cachedKey
  }

  // Fallback file
  const fileKey = readFileKey()
  if (fileKey && fileKey.length === 32) {
    cachedKey = fileKey
    return cachedKey
  }

  // Cria nova
  const newKey = randomBytes(32)
  const skipKeychain = process.env.ANDRECLAW_VAULT_NO_KEYCHAIN === '1'
  if (process.platform === 'darwin' && !skipKeychain) {
    try {
      await writeKeychainKey(newKey)
    } catch {
      // Keychain falhou (usuario cancelou prompt?) — fallback file
      await writeFileKey(newKey)
    }
  } else {
    await writeFileKey(newKey)
  }
  cachedKey = newKey
  return cachedKey
}

/**
 * Reseta cache (util em testes).
 */
export function _resetMasterKeyCache(): void {
  cachedKey = null
}

/**
 * Descobre onde a master key esta armazenada. Debugging only.
 */
export async function getMasterKeyLocation(): Promise<'keychain' | 'file' | 'none'> {
  if (process.platform === 'darwin') {
    const k = await tryReadKeychainKey()
    if (k) return 'keychain'
  }
  const f = readFileKey()
  if (f) return 'file'
  return 'none'
}
