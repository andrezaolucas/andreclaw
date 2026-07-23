/**
 * AndreClaw Wave 3+ (2026-07-23) — Persistent embeddings index.
 *
 * Storage: `~/.andreclaw/memdir/embeddings-index.jsonl` (append-only).
 * Cada linha: `{ path, mtimeMs, hash, vec }`.
 *
 * Design:
 * - Append-only: sem locks concorrentes, sem corrupção parcial
 * - Rebuild lazy: quando `mtimeMs` do arquivo muda, entrada antiga fica
 *   no jsonl mas ignorada em memory (nova versão sobrescreve via Map)
 * - Reset total via env `ANDRECLAW_REINDEX_MEMORIES=1` ou apagando o arquivo
 * - Schema-versioned: se dimensao/provider muda, invalida tudo
 */

import { appendFile, mkdir, readFile, stat, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

import type { MemoryEmbedding } from './types.js'

/**
 * Resolve HOME respeitando override via env (util em testes e sandboxing).
 * Fallback: `os.homedir()` (comportamento nativo).
 */
function resolveHome(): string {
  return process.env.HOME ?? homedir()
}

function getIndexDir(): string {
  return join(resolveHome(), '.andreclaw', 'memdir')
}
function getIndexFile(): string {
  return join(getIndexDir(), 'embeddings-index.jsonl')
}
function getMetaFile(): string {
  return join(getIndexDir(), 'embeddings-meta.json')
}

type IndexMeta = {
  provider: string
  model: string
  dim: number
  version: number
}

const CURRENT_VERSION = 1

/**
 * Cache em memoria por processo. Key = filePath.
 */
let cache: Map<string, MemoryEmbedding> | null = null

async function ensureDir(): Promise<void> {
  const dir = getIndexDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

async function readMeta(): Promise<IndexMeta | null> {
  try {
    const raw = await readFile(getMetaFile(), 'utf-8')
    return JSON.parse(raw) as IndexMeta
  } catch {
    return null
  }
}

async function writeMeta(meta: IndexMeta): Promise<void> {
  await ensureDir()
  await writeFile(getMetaFile(), JSON.stringify(meta, null, 2), 'utf-8')
}

/**
 * Carrega index do disco em memoria. Chamado apenas uma vez por processo.
 * Se provider/model/dim mudou, invalida tudo.
 */
export async function loadIndex(params: {
  provider: string
  model: string
  dim: number
}): Promise<Map<string, MemoryEmbedding>> {
  if (cache !== null) return cache

  if (process.env.ANDRECLAW_REINDEX_MEMORIES === '1') {
    cache = new Map()
    await writeMeta({ ...params, version: CURRENT_VERSION })
    return cache
  }

  const meta = await readMeta()
  const compatible =
    meta !== null &&
    meta.provider === params.provider &&
    meta.model === params.model &&
    meta.dim === params.dim &&
    meta.version === CURRENT_VERSION

  if (!compatible) {
    // Schema mudou — reset silencioso
    cache = new Map()
    await writeMeta({ ...params, version: CURRENT_VERSION })
    return cache
  }

  cache = new Map()
  try {
    const raw = await readFile(getIndexFile(), 'utf-8')
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        const entry = JSON.parse(line) as MemoryEmbedding
        // Ultima ocorrencia sobrescreve — append-only handling natural
        cache.set(entry.path, entry)
      } catch {
        // Linha corrompida — ignora silenciosamente
      }
    }
  } catch {
    // Arquivo nao existe ainda
  }
  return cache
}

/**
 * Salva/atualiza uma entrada no index. Faz append no jsonl + atualiza cache.
 */
export async function saveEntry(entry: MemoryEmbedding): Promise<void> {
  await ensureDir()
  if (cache) cache.set(entry.path, entry)
  await appendFile(getIndexFile(), JSON.stringify(entry) + '\n', 'utf-8')
}

/**
 * Reseta cache — testes ou pos-reindex explicito.
 */
export function _resetIndexCache(): void {
  cache = null
}

/**
 * Verifica se o arquivo mudou desde a ultima indexacao.
 * Retorna true se precisa reindexar.
 */
export async function needsReindex(
  filePath: string,
  existing: MemoryEmbedding | undefined,
): Promise<boolean> {
  if (!existing) return true
  try {
    const s = await stat(filePath)
    return s.mtimeMs !== existing.mtimeMs
  } catch {
    return true
  }
}
