# AgentShield-lite (AndreClaw Wave 2)

Camada leve de segurança inspirada no [`ecc-agentshield`](https://www.npmjs.com/package/ecc-agentshield)
mas 10x menor e sem SQLite manifest.

Foco em cybersec profissional: bloquear comandos destrutivos, detectar
secrets vazando, proteger arquivos de configuração de linter/formatter
que agentes tendem a "consertar" em vez de corrigir o código.

## Módulos

| Arquivo | Responsabilidade |
|---------|------------------|
| `dangerousCommands.ts` | Detecta comandos shell destrutivos (`rm -rf /`, `git push --force main`, fork bomb, `--no-verify`, etc.) |
| `secretPatterns.ts` | Regex de detecção de secrets (`sk-*`, `ghp_*`, `AKIA*`, JWT, PEM, xoxb, glpat, google OAuth) |
| `configProtection.ts` | Lista de arquivos protegidos (`.eslintrc`, `biome.json`, `.ruff.toml`, `tsconfig.json`, etc.) |
| `securityConfig.ts` | Perfis (`minimal | standard | strict`) via `~/.andreclaw/security.json` |

## Perfis

- **minimal**: só rm -rf raiz e fork bomb
- **standard** (default): + --no-verify, secrets, config protection
- **strict**: + push --force qualquer branch, dd, curl | sh

Override por env var: `ANDRECLAW_SECURITY_PROFILE=strict`

## Whitelist local

`~/.andreclaw/secrets-whitelist.json` — array de regexes que devem ser ignorados
mesmo que casem com um padrão de secret. Útil pra placeholders em docs.

```json
{
  "patterns": [
    "sk-example-.*",
    "ghp_YOUR_TOKEN_HERE"
  ]
}
```
