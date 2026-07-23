/**
 * AndreClaw Wave 3 (2026-07-23) — Ollama embeddings provider.
 *
 * Fala com o servidor Ollama local via HTTP.
 * Endpoint padrao: http://127.0.0.1:11434/api/embed
 * Env override: ANDRECLAW_OLLAMA_URL
 *
 * Modelos recomendados:
 * - nomic-embed-text (768d, ~250MB)
 * - bge-m3 (1024d, ~600MB, multilingue — melhor pra PT-BR)
 */

import type { EmbeddingsClient, EmbeddingVector } from './types.js'

const DEFAULT_URL = 'http://127.0.0.1:11434'
const DEFAULT_MODEL = 'nomic-embed-text'

function getUrl(): string {
  return (process.env.ANDRECLAW_OLLAMA_URL ?? DEFAULT_URL).replace(/\/+$/, '')
}

function getModel(): string {
  return process.env.ANDRECLAW_EMBEDDINGS_MODEL ?? DEFAULT_MODEL
}

/**
 * Verifica se Ollama esta disponivel e o modelo carregado.
 * Retorna undefined se nao disponivel (fallback pra outro provider).
 */
export async function tryCreateOllamaClient(
  signal?: AbortSignal,
): Promise<EmbeddingsClient | undefined> {
  const url = getUrl()
  const model = getModel()

  try {
    // Ping rapido pra verificar conectividade
    const tagsResp = await fetch(`${url}/api/tags`, { signal })
    if (!tagsResp.ok) return undefined
    const tagsJson = (await tagsResp.json()) as {
      models?: Array<{ name?: string }>
    }
    const hasModel = tagsJson.models?.some(m =>
      (m.name ?? '').startsWith(model),
    )
    if (!hasModel) return undefined

    // Warm-up + descoberta de dimensao
    const probe = await embedRaw(url, model, 'test', signal)
    if (!Array.isArray(probe) || probe.length === 0) return undefined

    return {
      name: 'ollama',
      model,
      dim: probe.length,
      async embed(input, sig) {
        return embedRaw(url, model, input, sig)
      },
    }
  } catch {
    return undefined
  }
}

async function embedRaw(
  url: string,
  model: string,
  input: string,
  signal?: AbortSignal,
): Promise<EmbeddingVector> {
  const resp = await fetch(`${url}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, input }),
    signal,
  })
  if (!resp.ok) {
    throw new Error(`Ollama /api/embed HTTP ${resp.status}`)
  }
  const json = (await resp.json()) as {
    embeddings?: number[][]
    embedding?: number[]
  }
  // Ollama 0.3+ retorna { embeddings: [[...]] }, versoes antigas retornam { embedding: [...] }
  if (Array.isArray(json.embeddings) && json.embeddings.length > 0) {
    return json.embeddings[0]
  }
  if (Array.isArray(json.embedding)) {
    return json.embedding
  }
  throw new Error('Ollama embed response sem embedding field')
}
