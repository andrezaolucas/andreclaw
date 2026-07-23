import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, rm, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { getVaultDreamConfig } from './config.js'

let origHome: string | undefined
let tempHome: string

beforeEach(async () => {
  origHome = process.env.HOME
  tempHome = join(tmpdir(), `vaultdream-config-${Date.now()}-${Math.random()}`)
  await mkdir(tempHome, { recursive: true })
  process.env.HOME = tempHome
  delete process.env.ANDRECLAW_VAULT_DREAM
  delete process.env.ANDRECLAW_VAULT_PATH
  delete process.env.ANDRECLAW_VAULT_DREAM_CRON
})

afterEach(async () => {
  if (origHome) process.env.HOME = origHome
  else delete process.env.HOME
  delete process.env.ANDRECLAW_VAULT_DREAM
  delete process.env.ANDRECLAW_VAULT_PATH
  delete process.env.ANDRECLAW_VAULT_DREAM_CRON
  if (existsSync(tempHome)) {
    await rm(tempHome, { recursive: true, force: true })
  }
})

describe('getVaultDreamConfig', () => {
  test('defaults quando sem settings.json', () => {
    const c = getVaultDreamConfig()
    expect(c.enabled).toBe(false) // sem vaultPath = disabled
    expect(c.dailyFolder).toBe('Daily')
    expect(c.memoryFolder).toBe('_memory')
    expect(c.cron).toBe('0 22 * * 0')
    expect(c.minDailies).toBe(3)
  })

  test('env off desliga forcado', async () => {
    process.env.ANDRECLAW_VAULT_DREAM = 'off'
    const c = getVaultDreamConfig()
    expect(c.enabled).toBe(false)
  })

  test('le settings.json', async () => {
    const settings = {
      vaultDream: {
        enabled: true,
        vaultPath: '/vault',
        dailyFolder: 'Daily',
        memoryFolder: '_memory',
        cron: '0 20 * * 0',
        minDailies: 5,
      },
    }
    await mkdir(join(tempHome, '.andreclaw'), { recursive: true })
    await writeFile(
      join(tempHome, '.andreclaw', 'settings.json'),
      JSON.stringify(settings),
    )
    const c = getVaultDreamConfig()
    expect(c.enabled).toBe(true)
    expect(c.vaultPath).toBe('/vault')
    expect(c.cron).toBe('0 20 * * 0')
    expect(c.minDailies).toBe(5)
  })

  test('env ANDRECLAW_VAULT_PATH vence config', async () => {
    const settings = { vaultDream: { enabled: true, vaultPath: '/vault-file' } }
    await mkdir(join(tempHome, '.andreclaw'), { recursive: true })
    await writeFile(
      join(tempHome, '.andreclaw', 'settings.json'),
      JSON.stringify(settings),
    )
    process.env.ANDRECLAW_VAULT_PATH = '/vault-env'
    const c = getVaultDreamConfig()
    expect(c.vaultPath).toBe('/vault-env')
  })

  test('env on ativa mesmo sem file, se tiver vaultPath', () => {
    process.env.ANDRECLAW_VAULT_DREAM = 'on'
    process.env.ANDRECLAW_VAULT_PATH = '/vault'
    const c = getVaultDreamConfig()
    expect(c.enabled).toBe(true)
    expect(c.vaultPath).toBe('/vault')
  })

  test('vaultPath vazio forca enabled=false', () => {
    process.env.ANDRECLAW_VAULT_DREAM = 'on'
    // sem ANDRECLAW_VAULT_PATH
    const c = getVaultDreamConfig()
    expect(c.enabled).toBe(false)
  })

  test('settings.json corrompido cai no default', async () => {
    await mkdir(join(tempHome, '.andreclaw'), { recursive: true })
    await writeFile(
      join(tempHome, '.andreclaw', 'settings.json'),
      'nao-e-json-valido',
    )
    const c = getVaultDreamConfig()
    expect(c.enabled).toBe(false) // default sem vault
    expect(c.dailyFolder).toBe('Daily')
  })
})
