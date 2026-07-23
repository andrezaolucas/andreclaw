/**
 * AndreClaw Wave 3+ (2026-07-23) — Semantic memory search entry point.
 *
 * `semanticRank(query, headers, signal)` retorna top-N memorias ordenadas
 * por cosine similarity contra a query. Faz caching persistente em
 * `~/.andreclaw/memdir/embeddings-index.jsonl`, reindex lazy quando mtime
 * do arquivo muda.
 *
 * Integration point: chamado por `findRelevantMemories.ts` antes do
 * Sonnet-selector. Se cliente indisponivel ou nenhum match forte, retorna
 * `null` e caller cai pro Sonnet.
 */

import { readFile } from 'fs/promises'

import { logForDebugging } from '../../utils/debug.js'
import type { MemoryHeader } from '../memoryScan.js'
import { getEmbeddingsClient } from './index.js'
import {
  loadIndex,
  needsReindex,
  saveEntry,
} from './indexStore.js'
import { cosineSimilarity, contentHash } from './similarity.js'
import type { EmbeddingsClient, MemoryEmbedding, SemanticMatch } from './types.js'

/** Score minimo pra considerar match relevante. Cosine baixo = ruido. */
const MIN_SCORE = 0.35

/** Quantos matches minimos precisamos pra confiar no semantic ranking. */
const MIN_STRONG_MATCHES = 3

/** Numero maximo de matches retornados (compat com Sonnet-selector). */
const MAX_MATCHES = 5

/** Leitura truncada — memorias enormes viram embedding descartavel. */
const MAX_CHARS_FOR_EMBEDDING = 8000

/**
 * Retorna top-N memorias ranqueadas por cosine similarity.
 *
 * Retorna `null` se:
 * - Cliente de embeddings indisponivel (sem Ollama nem OpenAI)
 * - Menos que `MIN_STRONG_MATCHES` matches com score >= `MIN_SCORE`
 *
 * Caller deve fallback pro Sonnet-selector quando `null`.
 */
export async function semanticRank(
  query: string,
  headers: readonly MemoryHeader[],
  signal: AbortSignal,
): Promise<SemanticMatch[] | null> {
  if (headers.length === 0) return null

  let client: EmbeddingsClient | undefined
  try {
    client = await getEmbeddingsClient(signal)
  } catch (e) {
    logForDebugging(`[semantic] getEmbeddingsClient failed: ${String(e)}`)
    return null
  }
  if (!client) return null

  const index = await loadIndex({
    provider: client.name,
    model: client.model,
    dim: client.dim,
  })

  // Embeddar a query
  let queryVec: number[]
  try {
    queryVec = await client.embed(query, signal)
  } catch (e) {
    logForDebugging(`[semantic] query embed failed: ${String(e)}`)
    return null
  }

  // Embeddar (ou reusar cache) cada memoria em paralelo, com bounded concurrency
  const CONCURRENCY = 4
  const memoryVecs: Array<{ header: MemoryHeader; vec: number[] } | null> = new Array(
    headers.length,
  )

  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < headers.length) {
      const i = cursor++
      const h = headers[i]
      try {
        memoryVecs[i] = { header: h, vec: await getOrCreateEmbedding(client!, h, index, signal) }
      } catch (e) {
        logForDebugging(`[semantic] embed ${h.filePath} failed: ${String(e)}`)
        memoryVecs[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  // Rank
  const matches: SemanticMatch[] = []
  for (const entry of memoryVecs) {
    if (!entry) continue
    const score = cosineSimilarity(queryVec, entry.vec)
    if (score >= MIN_SCORE) {
      matches.push({
        path: entry.header.filePath,
        mtimeMs: entry.header.mtimeMs,
        score,
      })
    }
  }
  matches.sort((a, b) => b.score - a.score)

  if (matches.length < MIN_STRONG_MATCHES) {
    logForDebugging(
      `[semantic] only ${matches.length} strong matches (< ${MIN_STRONG_MATCHES}), falling back to Sonnet`,
    )
    return null
  }
  return matches.slice(0, MAX_MATCHES)
}

async function getOrCreateEmbedding(
  client: EmbeddingsClient,
  header: MemoryHeader,
  index: Map<string, MemoryEmbedding>,
  signal: AbortSignal,
): Promise<number[]> {
  const existing = index.get(header.filePath)
  const stale = await needsReindex(header.filePath, existing)
  if (existing && !stale) {
    return existing.vec
  }

  // Le conteudo do arquivo (truncado). Se sao muitas memorias, isso e
  // custoso mas so acontece uma vez por arquivo.
  const raw = await readFile(header.filePath, 'utf-8')
  const truncated = raw.slice(0, MAX_CHARS_FOR_EMBEDDING)
  const vec = await client.embed(truncated, signal)

  const entry: MemoryEmbedding = {
    path: header.filePath,
    mtimeMs: header.mtimeMs,
    hash: contentHash(truncated),
    vec,
  }
  await saveEntry(entry)
  return vec
}
