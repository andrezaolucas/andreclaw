/**
 * AndreClaw Wave 5 (2026-07-23) — Provider healthcheck.
 *
 * Valida API key com endpoint de list-models de cada provider.
 * Timeout 10s. Sem retry (usuario re-executa se transient).
 */

import type { ProviderId, ValidateResult } from './types.js'

const TIMEOUT_MS = 10_000

export async function validate(
  provider: ProviderId,
  apiKey: string,
  signal?: AbortSignal,
): Promise<ValidateResult> {
  const url = getHealthcheckUrl(provider)
  const headers = buildHeaders(provider, apiKey)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  // Compose signals
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const resp = await fetch(url, { headers, signal: controller.signal })
    if (!resp.ok) {
      const body = await resp.text().catch(() => '')
      return {
        valid: false,
        reason: `HTTP ${resp.status}: ${body.slice(0, 200)}`,
      }
    }
    const data = (await resp.json()) as unknown
    const detectedModels = extractModels(provider, data)
    return { valid: true, detectedModels }
  } catch (e) {
    if (controller.signal.aborted) {
      return { valid: false, reason: 'timeout apos 10s' }
    }
    return {
      valid: false,
      reason: e instanceof Error ? e.message : String(e),
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

function getHealthcheckUrl(provider: ProviderId): string {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1/models'
    case 'deepseek':
      return 'https://api.deepseek.com/v1/models'
    case 'gemini':
      return 'https://generativelanguage.googleapis.com/v1beta/models'
    case 'groq':
      return 'https://api.groq.com/openai/v1/models'
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/models'
    case 'anthropic-key':
      return 'https://api.anthropic.com/v1/models'
  }
}

function buildHeaders(provider: ProviderId, apiKey: string): Record<string, string> {
  switch (provider) {
    case 'gemini':
      // Gemini usa x-goog-api-key
      return { 'x-goog-api-key': apiKey }
    case 'anthropic-key':
      return {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      }
    case 'openai':
    case 'deepseek':
    case 'groq':
    case 'openrouter':
    default:
      return { authorization: `Bearer ${apiKey}` }
  }
}

function extractModels(provider: ProviderId, data: unknown): string[] | undefined {
  if (!data || typeof data !== 'object') return undefined
  const d = data as Record<string, unknown>

  // OpenAI-compat (openai, deepseek, groq, openrouter, anthropic)
  if (Array.isArray(d.data)) {
    return d.data
      .filter((m): m is { id?: string } => typeof m === 'object' && m !== null)
      .map(m => m.id)
      .filter((id): id is string => typeof id === 'string')
      .slice(0, 10)
  }

  // Gemini
  if (Array.isArray(d.models)) {
    return d.models
      .filter((m): m is { name?: string } => typeof m === 'object' && m !== null)
      .map(m => m.name)
      .filter((name): name is string => typeof name === 'string')
      .slice(0, 10)
  }

  return undefined
}
