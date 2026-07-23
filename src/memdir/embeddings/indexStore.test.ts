import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, rm, stat, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import {
  _resetIndexCache,
  loadIndex,
  needsReindex,
  saveEntry,
} from './indexStore.js'
import type { MemoryEmbedding } from './types.js'

// Isola o teste do disco real do usuario redirecionando o HOME temporariamente.
let origHome: string | undefined
let tempHome: string

beforeEach(async () => {
  origHome = process.env.HOME
  tempHome = join(tmpdir(), `andreclaw-idx-test-${Date.now()}-${Math.random()}`)
  await mkdir(tempHome, { recursive: true })
  process.env.HOME = tempHome
  delete process.env.ANDRECLAW_REINDEX_MEMORIES
  _resetIndexCache()
})

afterEach(async () => {
  if (origHome) process.env.HOME = origHome
  else delete process.env.HOME
  if (existsSync(tempHome)) {
    await rm(tempHome, { recursive: true, force: true })
  }
  _resetIndexCache()
})

describe('indexStore', () => {
  test('loadIndex retorna Map vazio quando nao existe', async () => {
    const idx = await loadIndex({ provider: 'ollama', model: 'x', dim: 4 })
    expect(idx.size).toBe(0)
  })

  test('saveEntry persiste e loadIndex recupera', async () => {
    await loadIndex({ provider: 'ollama', model: 'x', dim: 4 })
    const entry: MemoryEmbedding = {
      path: '/tmp/foo.md',
      mtimeMs: 12345,
      hash: 'abc',
      vec: [1, 2, 3, 4],
    }
    await saveEntry(entry)

    _resetIndexCache()
    const idx = await loadIndex({ provider: 'ollama', model: 'x', dim: 4 })
    expect(idx.size).toBe(1)
    expect(idx.get('/tmp/foo.md')).toEqual(entry)
  })

  test('provider diferente invalida cache', async () => {
    await loadIndex({ provider: 'ollama', model: 'x', dim: 4 })
    await saveEntry({
      path: '/tmp/foo.md',
      mtimeMs: 1,
      hash: 'h',
      vec: [1, 2, 3, 4],
    })
    _resetIndexCache()

    // Agora carrega com provider diferente — cache deve resetar
    const idx = await loadIndex({ provider: 'openai', model: 'y', dim: 8 })
    expect(idx.size).toBe(0)
  })

  test('ANDRECLAW_REINDEX_MEMORIES=1 zera tudo', async () => {
    await loadIndex({ provider: 'ollama', model: 'x', dim: 4 })
    await saveEntry({
      path: '/tmp/foo.md',
      mtimeMs: 1,
      hash: 'h',
      vec: [1, 2, 3, 4],
    })
    _resetIndexCache()

    process.env.ANDRECLAW_REINDEX_MEMORIES = '1'
    const idx = await loadIndex({ provider: 'ollama', model: 'x', dim: 4 })
    expect(idx.size).toBe(0)
    delete process.env.ANDRECLAW_REINDEX_MEMORIES
  })

  test('needsReindex retorna true quando entry ausente', async () => {
    expect(await needsReindex('/tmp/nada.md', undefined)).toBe(true)
  })

  test('needsReindex retorna true quando mtime mudou', async () => {
    const filePath = join(tempHome, 'sample.md')
    await writeFile(filePath, 'v1')
    const s1 = await stat(filePath)
    const entry: MemoryEmbedding = {
      path: filePath,
      mtimeMs: s1.mtimeMs - 1000, // pretende ser antigo
      hash: 'x',
      vec: [1],
    }
    expect(await needsReindex(filePath, entry)).toBe(true)
  })

  test('needsReindex retorna false quando mtime igual', async () => {
    const filePath = join(tempHome, 'stable.md')
    await writeFile(filePath, 'v1')
    const s1 = await stat(filePath)
    const entry: MemoryEmbedding = {
      path: filePath,
      mtimeMs: s1.mtimeMs,
      hash: 'x',
      vec: [1],
    }
    expect(await needsReindex(filePath, entry)).toBe(false)
  })

  test('linha corrompida no jsonl e ignorada silenciosamente', async () => {
    // Semeia via API valida — cria diretorio implicito
    await loadIndex({ provider: 'ollama', model: 'x', dim: 4 })
    await saveEntry({
      path: '/tmp/ok.md',
      mtimeMs: 1,
      hash: 'h',
      vec: [1, 2, 3, 4],
    })

    // Ao carregar de novo, o diretorio ja existe
    const indexFile = join(
      tempHome,
      '.andreclaw',
      'memdir',
      'embeddings-index.jsonl',
    )
    const fs = await import('fs/promises')
    await fs.appendFile(indexFile, 'lixo nao-json\n{invalid": ]\n', 'utf-8')

    _resetIndexCache()
    const idx = await loadIndex({ provider: 'ollama', model: 'x', dim: 4 })
    expect(idx.size).toBe(1)
    expect(idx.get('/tmp/ok.md')).toBeDefined()
  })
})
