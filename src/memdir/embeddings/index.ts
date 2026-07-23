/**
 * AndreClaw Wave 3 (2026-07-23) — Semantic memory search.
 *
 * Ponto de entrada. Tenta Ollama, cai pra OpenAI, senao retorna undefined
 * (o Sonnet-selector segue funcionando sozinho).
 *
 * Cache do cliente por processo — provider discovery so acontece uma vez.
 */

import { tryCreateOllamaClient } from './ollamaProvider.js'
import { tryCreateOpenAIClient } from './openaiProvider.js'
import type { EmbeddingsClient, EmbeddingsProvider } from './types.js'

export type { EmbeddingsClient, EmbeddingsProvider, EmbeddingVector, MemoryEmbedding, SemanticMatch } from './types.js'
export { cosineSimilarity, contentHash } from './similarity.js'

let cachedClient: EmbeddingsClient | undefined
let clientDiscovered = false

function getConfiguredProvider(): EmbeddingsProvider | undefined {
  const raw = (process.env.ANDRECLAW_EMBEDDINGS_PROVIDER ?? '').toLowerCase()
  if (raw === 'ollama' || raw === 'openai' || raw === 'off') return raw
  return undefined
}

/**
 * Retorna cliente de embeddings ou undefined se nao disponivel.
 * Cacheia por processo.
 */
export async function getEmbeddingsClient(
  signal?: AbortSignal,
): Promise<EmbeddingsClient | undefined> {
  if (clientDiscovered) return cachedClient

  const configured = getConfiguredProvider()
  if (configured === 'off') {
    clientDiscovered = true
    cachedClient = undefined
    return undefined
  }

  // Provider forcado — respeitar mesmo se falhar (nao tenta fallback)
  if (configured === 'ollama') {
    cachedClient = await tryCreateOllamaClient(signal)
    clientDiscovered = true
    return cachedClient
  }
  if (configured === 'openai') {
    cachedClient = await tryCreateOpenAIClient()
    clientDiscovered = true
    return cachedClient
  }

  // Auto-discovery: tenta Ollama local primeiro (mais rapido, sem custo)
  cachedClient = await tryCreateOllamaClient(signal)
  if (cachedClient) {
    clientDiscovered = true
    return cachedClient
  }

  // Fallback: OpenAI
  cachedClient = await tryCreateOpenAIClient()
  clientDiscovered = true
  return cachedClient
}

/**
 * Reseta cache — util em testes ou apos mudanca de env.
 */
export function _resetEmbeddingsCache(): void {
  cachedClient = undefined
  clientDiscovered = false
}
