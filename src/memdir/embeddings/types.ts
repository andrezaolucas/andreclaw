/**
 * AndreClaw Wave 3 (2026-07-23) — Semantic memory search types.
 */

export type EmbeddingsProvider = 'ollama' | 'openai' | 'off'

export type EmbeddingVector = number[]

export type MemoryEmbedding = {
  path: string
  mtimeMs: number
  hash: string
  vec: EmbeddingVector
}

export type SemanticMatch = {
  path: string
  mtimeMs: number
  score: number // cosine similarity, -1..1
}

export type EmbeddingsClient = {
  embed(input: string, signal?: AbortSignal): Promise<EmbeddingVector>
  name: EmbeddingsProvider
  model: string
  dim: number
}
