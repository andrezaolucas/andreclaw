/**
 * AndreClaw Wave 3 (2026-07-23) — Cosine similarity + ranking.
 *
 * Puro, sem dependencia externa. ~5 linhas de math.
 */

import type { EmbeddingVector } from './types.js'

export function cosineSimilarity(
  a: EmbeddingVector,
  b: EmbeddingVector,
): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]
    const bi = b[i]
    dot += ai * bi
    normA += ai * ai
    normB += bi * bi
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 0
  return dot / denom
}

/**
 * Fast hash simples (djb2) pra invalidar embeddings quando conteudo muda
 * sem precisar reler o arquivo pra comparar bytes.
 */
export function contentHash(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  }
  return h.toString(16)
}
