/**
 * AgentShield-lite / Dangerous commands detector
 *
 * Analisa strings de comando shell e retorna motivo se o comando for
 * destrutivo/perigoso. Design 100% stateless — safe pra chamar em hooks
 * PreToolUse em hot-path.
 *
 * Perfis:
 * - minimal: so rm -rf de raiz e fork bomb
 * - standard (default): + --no-verify, dd, sudo rm
 * - strict: + push --force em qualquer branch, curl | sh, wget | sh
 */

export type SecurityProfile = 'minimal' | 'standard' | 'strict'

export type DangerousCommandFinding = {
  matched: string
  reason: string
  severity: 'critical' | 'high' | 'medium'
}

type Rule = {
  pattern: RegExp
  reason: string
  severity: 'critical' | 'high' | 'medium'
  profiles: readonly SecurityProfile[]
}

const RULES: readonly Rule[] = [
  // ============ CRITICAL — bloqueia em qualquer perfil ============
  {
    pattern: /\brm\s+(-[rRfF]+\s+)+\/(\s|$)/,
    reason: 'rm -rf na raiz do sistema — destroi tudo',
    severity: 'critical',
    profiles: ['minimal', 'standard', 'strict'],
  },
  {
    pattern: /\brm\s+(-[rRfF]+\s+)+~\/?(\s|$)/,
    reason: 'rm -rf no home directory — apaga configs, chaves, projetos',
    severity: 'critical',
    profiles: ['minimal', 'standard', 'strict'],
  },
  {
    pattern: /:\s*\(\s*\)\s*\{\s*:\|\s*:&\s*\}\s*;\s*:/,
    reason: 'Fork bomb — trava a maquina',
    severity: 'critical',
    profiles: ['minimal', 'standard', 'strict'],
  },
  {
    pattern: /\bmkfs\.(ext[234]|xfs|btrfs|vfat|ntfs)\b/,
    reason: 'mkfs — formata um filesystem, apaga dados',
    severity: 'critical',
    profiles: ['minimal', 'standard', 'strict'],
  },

  // ============ HIGH — standard+ ============
  {
    pattern: /\bsudo\s+rm\s+(-[rRfF]+\s+)+/,
    reason: 'sudo rm -rf — remove com root privileges',
    severity: 'high',
    profiles: ['standard', 'strict'],
  },
  {
    pattern: /\bdd\s+.*of=\/dev\/(sd|nvme|hd|disk)/,
    reason: 'dd escrevendo em disco raw — pode corromper disco inteiro',
    severity: 'critical',
    profiles: ['minimal', 'standard', 'strict'],
  },
  {
    pattern: /\bgit\s+.*--no-verify\b/,
    reason: 'git --no-verify — pula pre-commit hooks (bypass de linter/testes)',
    severity: 'high',
    profiles: ['standard', 'strict'],
  },
  {
    pattern: /\bgit\s+push\s+.*--force(-with-lease)?\s+.*\b(main|master|prod|production|release)\b/,
    reason: 'git push --force em branch protegida (main/master/prod)',
    severity: 'high',
    profiles: ['standard', 'strict'],
  },
  {
    pattern: /\bgit\s+.*(reset\s+--hard|clean\s+-[fF]d)\b.*(main|master|origin\/main|origin\/master)/,
    reason: 'git reset --hard / clean -fd em main — perde trabalho',
    severity: 'high',
    profiles: ['standard', 'strict'],
  },

  // ============ MEDIUM — strict only ============
  {
    pattern: /\bgit\s+push\s+.*--force(-with-lease)?\b/,
    reason: 'git push --force (perfil strict bloqueia em qualquer branch)',
    severity: 'medium',
    profiles: ['strict'],
  },
  {
    pattern: /\bcurl\s+.*\|\s*(sudo\s+)?(bash|sh|zsh)\b/,
    reason: 'curl | sh — executa script remoto sem revisao',
    severity: 'medium',
    profiles: ['strict'],
  },
  {
    pattern: /\bwget\s+.*\|\s*(sudo\s+)?(bash|sh|zsh)\b/,
    reason: 'wget | sh — executa script remoto sem revisao',
    severity: 'medium',
    profiles: ['strict'],
  },
  {
    pattern: /\bchmod\s+.*777\s+/,
    reason: 'chmod 777 — permissao world-writable',
    severity: 'medium',
    profiles: ['strict'],
  },
]

/**
 * Analisa um comando shell e retorna todos os findings aplicaveis ao perfil.
 * Vazio = comando limpo.
 */
export function detectDangerousCommands(
  command: string,
  profile: SecurityProfile = 'standard',
): DangerousCommandFinding[] {
  const findings: DangerousCommandFinding[] = []
  for (const rule of RULES) {
    if (!rule.profiles.includes(profile)) continue
    const match = rule.pattern.exec(command)
    if (match) {
      findings.push({
        matched: match[0],
        reason: rule.reason,
        severity: rule.severity,
      })
    }
  }
  return findings
}

/**
 * Retorna apenas findings criticos (nao ha bypass mesmo em minimal).
 */
export function hasCriticalDanger(command: string): boolean {
  return detectDangerousCommands(command, 'minimal').some(
    f => f.severity === 'critical',
  )
}
