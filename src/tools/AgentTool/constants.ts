export const AGENT_TOOL_NAME = 'Agent'
// Legacy wire name for backward compat (permission rules, hooks, resumed sessions)
export const LEGACY_AGENT_TOOL_NAME = 'Task'
export const VERIFICATION_AGENT_TYPE = 'verification'

// Built-in agents that run once and return a report — the parent never
// SendMessages back to continue them. Skip the agentId/SendMessage/usage
// trailer for these to save tokens (~135 chars × 34M Explore runs/week).
export const ONE_SHOT_BUILTIN_AGENT_TYPES: ReadonlySet<string> = new Set([
  'Explore',
  'Plan',
])

/**
 * AndreClaw Wave 2 (2026-07-23): Nested subagents depth cap.
 *
 * Anthropic declara 5 niveis maximos (v2.1.172), mas na pratica probes
 * chegaram a 9 sem falhar. Aqui aplicamos cap declarativo de 5 alinhado
 * com o comportamento oficial.
 *
 * Override:
 * - `ANDRECLAW_MAX_AGENT_DEPTH` (env var, integer)
 * - Ao atingir cap, AgentTool retorna erro claro em vez de spawn silencioso.
 *
 * Depth 0 = raiz (main loop). Cada spawn incrementa em 1.
 */
export const DEFAULT_MAX_AGENT_DEPTH = 5

export function getMaxAgentDepth(): number {
  const raw = process.env.ANDRECLAW_MAX_AGENT_DEPTH
  if (!raw) return DEFAULT_MAX_AGENT_DEPTH
  const parsed = Number.parseInt(raw, 10)
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 20) {
    return parsed
  }
  return DEFAULT_MAX_AGENT_DEPTH
}
