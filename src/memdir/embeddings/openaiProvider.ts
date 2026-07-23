/**
 * AndreClaw Wave 3 (2026-07-23) — OpenAI embeddings provider (fallback).
 *
 * Ativado quando `OPENAI_API_KEY` esta setado e Ollama nao respondeu.
 * Modelo default: text-embedding-3-small (1536d, $0.02/M tokens).
 */

import type { EmbeddingsClient, EmbeddingVector } from './types.js'

const API_URL = 'https://api.openai.com/v1/embeddings'
const DEFAULT_MODEL = 'text-embedding-3-small'

function getModel(): string {
  return process.env.ANDRECLAW_EMBEDDINGS_MODEL ?? DEFAULT_MODEL
}

/**
 * Cria cliente se OPENAI_API_KEY disponivel.
 * Nao faz probe imediato — trust env-based config.
 */
export async function tryCreateOpenAIClient(): Promise<
  EmbeddingsClient | undefined
> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return undefined

  const model = getModel()
  // Dimensao inferida do modelo — text-embedding-3-small=1536, 3-large=3072
  const dim = model.includes('large') ? 3072 : 1536

  return {
    name: 'openai',
    model,
    dim,
    async embed(input, sig) {
      return embedRaw(apiKey, model, input, sig)
    },
  }
}

async function embedRaw(
  apiKey: string,
  model: string,
  input: string,
  signal?: AbortSignal,
): Promise<EmbeddingVector> {
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input, encoding_format: 'float' }),
    signal,
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`OpenAI embeddings HTTP ${resp.status}: ${text.slice(0, 200)}`)
  }
  const json = (await resp.json()) as {
    data?: Array<{ embedding?: number[] }>
  }
  const vec = json.data?.[0]?.embedding
  if (!Array.isArray(vec)) {
    throw new Error('OpenAI embeddings response sem embedding field')
  }
  return vec
}
