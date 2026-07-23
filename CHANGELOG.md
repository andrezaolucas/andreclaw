# Changelog

Todos os changes relevantes do AndreClaw sao documentados aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
e versionamento [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — v1.5.0 (Wave 3)

### Adicionado — Skills
- Skill folder protection expandida em `checkPathSafetyForAutoEdit()`: `.andreclaw/{commands,agents,skills}/` agora sao bypass-immune (nao editaveis mesmo com `--dangerously-skip-permissions`), alinhado com Anthropic v2.1.126.
- Confirmado que `context: 'inline' | 'fork'` no `BundledSkillDefinition` + `loadSkillsDir` ja estavam funcionais (parsing em `bundledSkills.ts:27` e execution em `loadSkillsDir.ts:260`).
- Confirmado que argument substitution (`$ARGUMENTS`, `$ARGUMENTS[0]`, `$0`, `$1`, named args) ja estava implementada em `src/utils/argumentSubstitution.ts` — alinhado com sintaxe oficial Anthropic e Nano v3.
- Confirmado que `/batch` bundled skill ja usa `isolation: "worktree"` + `run_in_background: true` alinhado com Anthropic v2.1.63.

### Adicionado — Memoria semantica (`src/memdir/embeddings/`)
- Sistema opcional de busca semantica com embeddings, complementar (nao substitutivo) do Sonnet-selector existente em `findRelevantMemories.ts`.
- Provider **Ollama local** (`nomic-embed-text` ou `bge-m3`) auto-descoberto via HTTP em `127.0.0.1:11434` — zero-cost, offline, ideal pra PT-BR com bge-m3.
- Provider **OpenAI** (`text-embedding-3-small` = 1536d, `text-embedding-3-large` = 3072d) como fallback quando `OPENAI_API_KEY` disponivel.
- Env vars: `ANDRECLAW_EMBEDDINGS_PROVIDER=ollama|openai|off`, `ANDRECLAW_EMBEDDINGS_MODEL=<nome>`, `ANDRECLAW_OLLAMA_URL=<url>`, `ANDRECLAW_REINDEX_MEMORIES=1`.
- Cache de cliente por processo — provider discovery so acontece uma vez.
- Cosine similarity + contentHash puros (5 linhas cada).
- 11 testes unitarios, 0 falhas.

### Adicionado — Sub-agentes especializados do Andre
Criados em `SecondBrain/andre/.claude/agents/`:
- **agenzai-deployer** (color: red, memory: project) — Hetzner 178.156.158.10/243.167, Patroni/PgBouncer, Redis Sentinel, WireGuard, staging `/home/ubuntu/agenzai-staging`, SHA prod `93053719...`. Bloqueia AWS/SSM. Bloqueia ManyChat pra contas politicas.
- **syncra-sqlite-expert** (blue, project) — 2B+ records em 12 SQLite DBs, Supabase sync, FastAPI, server 89.167.31.100.
- **obsidian-curator** (purple, project) — CRUD respeitando regras do CLAUDE.md (wikilinks, callouts, frontmatter YAML, templates, backlinks bidirecionais).
- **security-auditor** (yellow, user — aprende cross-project) — OWASP Top 10, dependency scanning, secret detection, config audit. Aliado ao AgentShield-lite.
- **lyvia-swift-reviewer** (green, project) — Review SwiftUI iOS + Node.js backend com padroes premium fitness.

### Planejado (Wave 4)
- Outcomes framework local
- Dreaming local via `autoDream` + `ScheduleCronTool`
- Integracao real do `findRelevantMemories` com o modulo de embeddings

## [Unreleased] — v1.4.0 (Wave 2)

### Adicionado — Multi-agent
- Nested subagents com cap declarativo (default 5, override `ANDRECLAW_MAX_AGENT_DEPTH`). Ao atingir cap, `AgentTool` retorna erro claro em vez de spawn silencioso. Depth propaga automaticamente via `options.agentDepth` em `runAgent.ts` e sobrevive autocompact.
- Feature flag `FORK_SUBAGENT` ativada no build (era default `false`)
- `CLAUDE_CODE_FORK_SUBAGENT=1` / `ANDRECLAW_FORK_SUBAGENT=1` liberam fork subagent em modo nao-interativo (headless CLI + Agent SDK), alinhado com Anthropic v2.1.121
- Feature flags `MEMORY_SHAPE_TELEMETRY` e `AGENT_MEMORY_SNAPSHOT` ativadas

### Adicionado — AgentShield-lite (`src/utils/security/`)
- `dangerousCommands.ts` — 13 regras cobrindo `rm -rf /`, fork bomb, `mkfs`, `dd` em raw disk, `sudo rm`, `git --no-verify`, `git push --force main`, `git reset --hard main`, `curl | sh`, `chmod 777`. Perfis `minimal | standard | strict`.
- `secretPatterns.ts` — 15 padroes (Anthropic API keys, OpenAI, GitHub PAT/OAuth/App, AWS, Slack bot/user, GitLab PAT, Google OAuth, PEM private key, JWT, Stripe, Twilio, SendGrid, Discord). Whitelist local em `~/.andreclaw/secrets-whitelist.json`.
- `configProtection.ts` — protege 30+ arquivos de config (ESLint, Biome, Prettier, Ruff, Mypy, tsconfig, Stylelint, Rubocop, golangci-lint, editorconfig) contra edits automaticos.
- `securityConfig.ts` — carrega perfil de `~/.andreclaw/security.json` + env `ANDRECLAW_SECURITY_PROFILE` (env vence). Env `ANDRECLAW_SECURITY_DISABLED=csv` desliga features especificas.
- 67 testes unitarios (dangerous + secrets + config), 0 falhas.

### Integrado
- `BashTool.validateInput` bloqueia comandos perigosos antes de canUseTool
- `FileWriteTool.validateInput` + `FileEditTool.validateInput` bloqueiam config protegida + secrets

### Planejado (Waves 3–4)
- Skills com `context: fork` + argument substitution (`$ARGUMENTS`, `$1`, `$2`)
- Skill folder protection alinhada com Anthropic v2.1.126
- Fix `/usage` memory leak (transcripts truncados, LSP LRU cap, MCP stderr cap)
- Memoria semantica opcional (Ollama `nomic-embed-text` / `bge-m3`)
- Sub-agentes especializados do Andre (agenzai-deployer, syncra-sqlite-expert, obsidian-curator, security-auditor, lyvia-swift-reviewer)
- Dreaming local via `autoDream` + `ScheduleCronTool`
- Outcomes framework local

## [Unreleased] — v1.3.0 (Wave 1)

### Adicionado
- Auditoria completa de gap com upstream em `Projetos/AndreClaw/auditoria-gap-upstream-2026-07-23.md` no vault
- Remote `upstream` (`T-Lab-CUHKSZ/claude-code`) e `anthropic-ref` (`anthropics/claude-code`) configurados
- Workflow `.github/workflows/upstream-sync.yml` — cron semanal (segundas 08:00 -03) que abre issue `upstream-drift` quando o upstream ganha commits novos
- Workflow `pr-checks.yml` agora inclui `typecheck` (warn-only) e `doctor:runtime` em cada PR
- `.github/dependabot.yml` monitorando `@anthropic-ai/*`, `ink`, `react`, `openai`, `bun-types`, `typescript`, `ollama` semanalmente + GitHub Actions mensal
- Este `CHANGELOG.md` estruturado
- `scripts/build.ts` agora copia `vendor/` → `dist/vendor/` automaticamente (fix `dist/vendor/ripgrep/arm64-darwin/rg` ausente)

## [1.2.9] — 2026-04-05

### Adicionado (release retroativo — pre-CHANGELOG)
- Auto-cd pro vault Obsidian na inicializacao
- Validacao de pasta como vault Obsidian antes de criar estrutura
- Provider bootstrap system (`scripts/provider-bootstrap.ts`)
- Provider recommendation (`scripts/provider-recommend.ts`)
- Multi-provider real: OpenAI, Ollama, Gemini, Codex, Atomic Chat
- Smart router entre providers (`smart_router.py`)
- Voice mode com Whisper + STT streaming
- i18n PT-BR nativo
- Ink TUI com React
- 40+ tools (AgentTool, SkillTool, BashTool, LSPTool, REPLTool, ScheduleCronTool, RemoteTriggerTool, TeamCreate/Delete, SendMessage, etc.)
- 17 skills bundled (batch, remember, simplify, skillify, verify, stuck, loop, updateConfig, keybindings, etc.)
- Memoria persistente em `~/.andreclaw/`
- SessionMemory + extractMemories + autoDream services
- Chrome, Slack, GitHub apps integrations
- PowerShell cross-platform
- Vim mode
- Upstream proxy
- CI (`pr-checks.yml`) e npm publish (`publish.yml`)

### Congelado
- Nenhum commit desde 05/04/2026 ate a Wave 1 do roadmap de modernizacao 2026-07-23

## [0.1.8] — 2026-04-04

- Fork inicial do vazamento do Claude Code v2.1.88 (31/03/2026)
- Branding "Claudinho" original, posteriormente renomeado pra AndreClaw
- README inicial + docs de historico de conversas
