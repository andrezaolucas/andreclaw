/**
 * AgentShield-lite / Secret detection
 *
 * Regex de deteccao de secrets comuns (API keys, tokens, private keys).
 * Chamado em hooks PreToolUse e em file writes pra evitar que o agente
 * escreva credencial em log/commit/mensagem.
 *
 * Whitelist:
 * `~/.andreclaw/secrets-whitelist.json` — array `patterns` de regexes que
 * devem ser ignorados mesmo se casarem. Util pra placeholders em docs.
 */

import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export type SecretFinding = {
  matched: string
  patternName: string
  severity: 'critical' | 'high'
}

type SecretRule = {
  name: string
  pattern: RegExp
  severity: 'critical' | 'high'
}

/**
 * Padroes conservadores (baixa false-positive rate).
 * Prefira nao detectar do que gerar ruido de whitelist infinita.
 */
const RULES: readonly SecretRule[] = [
  {
    name: 'anthropic-api-key',
    pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/,
    severity: 'critical',
  },
  {
    name: 'openai-api-key',
    pattern: /\bsk-(proj-)?[A-Za-z0-9_-]{20,}\b/,
    severity: 'critical',
  },
  {
    name: 'github-personal-token',
    pattern: /\bghp_[A-Za-z0-9]{36}\b/,
    severity: 'critical',
  },
  {
    name: 'github-oauth-token',
    pattern: /\bgho_[A-Za-z0-9]{36}\b/,
    severity: 'critical',
  },
  {
    name: 'github-app-token',
    pattern: /\b(ghs_|ghu_)[A-Za-z0-9]{36}\b/,
    severity: 'critical',
  },
  {
    name: 'aws-access-key-id',
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
    severity: 'critical',
  },
  {
    name: 'aws-secret-key',
    // Match "aws_secret_access_key = <40 chars base64>" pra reduzir FP
    pattern: /aws_secret_access_key\s*[=:]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/i,
    severity: 'critical',
  },
  {
    name: 'slack-bot-token',
    pattern: /\bxoxb-[A-Za-z0-9-]{10,}\b/,
    severity: 'high',
  },
  {
    name: 'slack-user-token',
    pattern: /\bxox[pao]-[A-Za-z0-9-]{10,}\b/,
    severity: 'high',
  },
  {
    name: 'gitlab-personal-access-token',
    pattern: /\bglpat-[A-Za-z0-9_-]{20}\b/,
    severity: 'critical',
  },
  {
    name: 'google-oauth-access-token',
    pattern: /\bya29\.[A-Za-z0-9_-]{20,}\b/,
    severity: 'high',
  },
  {
    name: 'private-key-pem',
    pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/,
    severity: 'critical',
  },
  {
    name: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/,
    severity: 'high',
  },
  {
    name: 'stripe-secret-key',
    pattern: /\b(sk|rk)_(test|live)_[A-Za-z0-9]{20,}\b/,
    severity: 'critical',
  },
  {
    name: 'twilio-account-sid',
    pattern: /\bAC[a-f0-9]{32}\b/,
    severity: 'high',
  },
  {
    name: 'sendgrid-api-key',
    pattern: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/,
    severity: 'critical',
  },
  {
    name: 'discord-bot-token',
    pattern: /\b[MN][A-Za-z\d]{23,25}\.[A-Za-z\d_-]{6}\.[A-Za-z\d_-]{27,}\b/,
    severity: 'high',
  },
]

/**
 * Carrega whitelist do disco. Cache em memoria por processo.
 */
let cachedWhitelist: RegExp[] | null = null

function loadWhitelist(): RegExp[] {
  if (cachedWhitelist !== null) return cachedWhitelist

  const whitelistPath = join(homedir(), '.andreclaw', 'secrets-whitelist.json')
  if (!existsSync(whitelistPath)) {
    cachedWhitelist = []
    return cachedWhitelist
  }

  try {
    const raw = readFileSync(whitelistPath, 'utf-8')
    const parsed = JSON.parse(raw) as { patterns?: unknown }
    if (Array.isArray(parsed.patterns)) {
      cachedWhitelist = parsed.patterns
        .filter((p): p is string => typeof p === 'string')
        .map(p => {
          try {
            return new RegExp(p)
          } catch {
            return null
          }
        })
        .filter((r): r is RegExp => r !== null)
    } else {
      cachedWhitelist = []
    }
  } catch {
    cachedWhitelist = []
  }
  return cachedWhitelist
}

/**
 * Limpa cache — util em testes. Nao chamar em hot path.
 */
export function _resetSecretWhitelistCache(): void {
  cachedWhitelist = null
}

/**
 * Analisa uma string e retorna secrets detectados (excluindo whitelisted).
 * Vazio = string limpa.
 */
export function detectSecrets(input: string): SecretFinding[] {
  if (!input || input.length === 0) return []

  const whitelist = loadWhitelist()
  const findings: SecretFinding[] = []

  for (const rule of RULES) {
    const match = rule.pattern.exec(input)
    if (!match) continue

    const matched = match[0]
    if (whitelist.some(w => w.test(matched))) continue

    findings.push({
      matched,
      patternName: rule.name,
      severity: rule.severity,
    })
  }
  return findings
}

/**
 * Boolean quick-check pra hot path (sem alocar array).
 */
export function hasSecrets(input: string): boolean {
  if (!input || input.length === 0) return false
  return detectSecrets(input).length > 0
}
