import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { chmod, mkdir, rm, stat, writeFile } from 'fs/promises'
import { existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { _resetMasterKeyCache } from './masterKey.js'
import {
  envVarForProvider,
  get,
  list,
  remove,
  set,
} from './vault.js'

let origHome: string | undefined
let tempHome: string
let origEnvVars: Record<string, string | undefined> = {}

const ENV_VARS_TO_CLEAR = [
  'OPENAI_API_KEY',
  'DEEPSEEK_API_KEY',
  'GEMINI_API_KEY',
  'GROQ_API_KEY',
  'OPENROUTER_API_KEY',
  'ANTHROPIC_API_KEY',
]

beforeEach(async () => {
  origHome = process.env.HOME
  tempHome = join(tmpdir(), `vault-test-${Date.now()}-${Math.random()}`)
  await mkdir(tempHome, { recursive: true })
  process.env.HOME = tempHome
  // Forcar file-based master key nos testes (evita Keychain prompt de senha)
  process.env.ANDRECLAW_VAULT_NO_KEYCHAIN = '1'

  // Salvar + limpar env vars de provider (evita contaminacao)
  origEnvVars = {}
  for (const v of ENV_VARS_TO_CLEAR) {
    origEnvVars[v] = process.env[v]
    delete process.env[v]
  }

  _resetMasterKeyCache()
})

afterEach(async () => {
  if (origHome) process.env.HOME = origHome
  else delete process.env.HOME
  delete process.env.ANDRECLAW_VAULT_NO_KEYCHAIN

  // Restaurar env vars
  for (const v of ENV_VARS_TO_CLEAR) {
    if (origEnvVars[v] !== undefined) process.env[v] = origEnvVars[v]
    else delete process.env[v]
  }

  if (existsSync(tempHome)) {
    await rm(tempHome, { recursive: true, force: true })
  }
  _resetMasterKeyCache()
})

describe('vault — CRUD', () => {
  test('list vazio quando nao ha credentials', () => {
    expect(list()).toEqual([])
  })

  test('set + get round-trip', async () => {
    await set('deepseek', 'sk-deepseek-abcd1234')
    const val = await get('deepseek')
    expect(val).toBe('sk-deepseek-abcd1234')
  })

  test('set sobrescreve credential existente', async () => {
    await set('openai', 'sk-old-value-1234')
    await set('openai', 'sk-new-value-12345')
    expect(await get('openai')).toBe('sk-new-value-12345')
    // list mostra so 1 entry
    expect(list().filter(c => c.provider === 'openai')).toHaveLength(1)
  })

  test('remove apaga credential', async () => {
    await set('groq', 'gsk-abc123456789')
    expect(await get('groq')).toBe('gsk-abc123456789')
    const removed = await remove('groq')
    expect(removed).toBe(true)
    expect(await get('groq')).toBeUndefined()
  })

  test('remove idempotente (nao lanca se nao existe)', async () => {
    const removed = await remove('gemini')
    expect(removed).toBe(false)
  })

  test('list retorna metadata sem revelar valor', async () => {
    await set('deepseek', 'sk-super-secret-abcdefgh')
    const items = list()
    expect(items).toHaveLength(1)
    const item = items[0]
    expect(item.provider).toBe('deepseek')
    expect(item.hint).toContain('***')
    expect(item.hint).not.toContain('super')
    expect(item.addedAt).toBeDefined()
    // metadata nao tem 'value'
    expect((item as unknown as { value: unknown }).value).toBeUndefined()
  })

  test('set rejeita valor muito curto', async () => {
    await expect(set('openai', 'abc')).rejects.toThrow()
    await expect(set('openai', '')).rejects.toThrow()
  })

  test('multiplos providers coexistem', async () => {
    await set('openai', 'sk-openai-abc123')
    await set('deepseek', 'sk-deepseek-abc123')
    await set('gemini', 'AIza-gemini-abc123')

    expect(await get('openai')).toBe('sk-openai-abc123')
    expect(await get('deepseek')).toBe('sk-deepseek-abc123')
    expect(await get('gemini')).toBe('AIza-gemini-abc123')
    expect(list()).toHaveLength(3)
  })
})

describe('vault — precedencia com env var', () => {
  test('env var vence vault (compat legada)', async () => {
    await set('openai', 'sk-vault-value')
    process.env.OPENAI_API_KEY = 'sk-env-wins'
    expect(await get('openai')).toBe('sk-env-wins')
  })

  test('sem env var, vault e usado', async () => {
    delete process.env.OPENAI_API_KEY
    await set('openai', 'sk-vault-fallback')
    expect(await get('openai')).toBe('sk-vault-fallback')
  })
})

describe('vault — arquivo persistente', () => {
  test('arquivo credentials.enc criado com mode 0600', async () => {
    await set('openai', 'sk-perm-check-abc')
    const path = join(tempHome, '.andreclaw', 'credentials.enc')
    expect(existsSync(path)).toBe(true)
    const s = await stat(path)
    // mode & 0o777 pra pegar so as perms
    expect(s.mode & 0o777).toBe(0o600)
  })

  test('arquivo nao contem valor plain', async () => {
    const secret = 'sk-super-secret-plain-text-abcdefg'
    await set('openai', secret)
    const path = join(tempHome, '.andreclaw', 'credentials.enc')
    const raw = readFileSync(path, 'utf-8')
    expect(raw).not.toContain(secret)
    expect(raw).not.toContain('plain-text')
  })

  test('arquivo corrompido nao quebra list()', async () => {
    const path = join(tempHome, '.andreclaw', 'credentials.enc')
    await mkdir(join(tempHome, '.andreclaw'), { recursive: true })
    await writeFile(path, 'nao-e-json-valido-{{{', { mode: 0o600 })
    expect(list()).toEqual([])
  })
})

describe('envVarForProvider', () => {
  test('mapeia todos providers', () => {
    expect(envVarForProvider('openai')).toBe('OPENAI_API_KEY')
    expect(envVarForProvider('deepseek')).toBe('DEEPSEEK_API_KEY')
    expect(envVarForProvider('gemini')).toBe('GEMINI_API_KEY')
    expect(envVarForProvider('groq')).toBe('GROQ_API_KEY')
    expect(envVarForProvider('openrouter')).toBe('OPENROUTER_API_KEY')
    expect(envVarForProvider('anthropic-key')).toBe('ANTHROPIC_API_KEY')
  })
})
