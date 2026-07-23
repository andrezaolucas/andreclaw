# Changelog

Todos os changes relevantes do AndreClaw sao documentados aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
e versionamento [SemVer](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — v2.0.1 (Bugfix)

### Corrigido — Model resolver com contaminacao cruzada de providers
- `getUserSpecifiedModelSetting()` em `src/utils/model/model.ts` agora consulta o `APIProvider` ativo (via `getAPIProvider()`) antes de escolher qual env var de model usar.
- **Bug anterior**: pegava `ANTHROPIC_MODEL || GEMINI_MODEL || OPENAI_MODEL` na cascata, o que fazia AndreClaw iniciar com `deepseek-chat` quando o user tinha `OPENAI_MODEL=deepseek-chat` setado no shell mesmo rodando com provider firstParty (Claude Max). Startup mostrava "Model deepseek-chat" no header e a primeira mensagem retornava "There's an issue with the selected model (deepseek-chat). It may not exist or you may not have access to it. Run /model to pick a different model."
- **Fix**: env var e escolhida pelo provider ativo — `firstParty|bedrock|vertex|foundry|github` → `ANTHROPIC_MODEL`; `openai|codex` → `OPENAI_MODEL`; `gemini` → `GEMINI_MODEL`.
- Zero regressao: 131/131 testes passando.

## [Unreleased] — v2.0.0 (Wave 4)

### Adicionado — Outcomes Framework (`src/services/Outcomes/`)
- Sistema local de rubric-based validation, inspirado no Outcomes da Managed Agents API mas 100% local (sem beta).
- `rubricParser.ts`: parseia markdown com frontmatter (`name`, `threshold` 0..1, `max_iterations`) + secoes `### <nome> (peso: N)` com checklist.
- `grader.ts`: `grade()` puro sem dependencia de LLM (recebe `CriterionEvaluator` como parametro). Score = weighted average por peso. Passed = score >= threshold E todos criterios individuais passaram. Concurrency 3 workers.
- `outcomeStore.ts`: log append-only em `~/.andreclaw/outcomes/outcomes.jsonl` + `computeStats()` que agrega por rubric (pass rate, avg score, avg iterations).
- `isOutcomesEnabled()` respeitando env `ANDRECLAW_OUTCOMES=off`.
- 20 testes unitarios (parser + grader + store).

### Adicionado — Vault Dream (`src/services/vaultDream/`)
- Consolidacao agendada de daily notes do vault Obsidian, complementar ao `autoDream` existente (que consolida `~/.andreclaw/memory/`).
- `dateHelpers.ts`: startOfWeek/endOfWeek em UTC (ISO 8601 — segunda a domingo), parseIsoDate, extractDateFromFilename.
- `dailyScanner.ts`: `scanDailies()` le pasta `Daily/` do vault, parseia frontmatter, sorted desc. `bucketByWeek()` agrupa em semanas ISO. `pickConsolidatableWeeks()` filtra por: (a) >= minDailies notas, (b) nenhuma ja consolidada, (c) semana ja terminou.
- `config.ts`: le `~/.andreclaw/settings.json` -> `vaultDream: {...}`, com overrides via env `ANDRECLAW_VAULT_DREAM=on|off`, `ANDRECLAW_VAULT_PATH`, `ANDRECLAW_VAULT_DREAM_CRON`. Default cron: domingo 22h.
- 25 testes unitarios (dateHelpers + scanner + config).

### Documentado — CI/CD startup_failure
- Diagnostico em `Projetos/AndreClaw/ci-startup-failure-diagnostico-2026-07-23.md` (no vault).
- Root cause identificado: **free tier de 2.000 min/mes de GitHub Actions em repos privados foi estourado** (julho: 4.086 min). Todos os workflows falham com startup_failure sem log.
- Nao e problema de YAML ou permissao. Confirmado com workflow trivial `hello-test.yml`.
- Solucoes sugeridas: tornar repo publico (grande recomendacao), upgrade Pro ($4/mes), self-hosted runner na Hetzner, ou desligar workflows nao essenciais.

### Metricas
- **131/131 testes passando** (67 security + 19 embeddings + 20 Outcomes + 25 vaultDream)
- Build ok, smoke ok
- Zero regressao — todas features sao opt-in (env vars ou explicit call)

## [Unreleased] — v1.5.1 (Wave 3.5)

### Adicionado — Integracao real da memoria semantica
- `src/memdir/embeddings/semanticSearch.ts` — funcao `semanticRank(query, headers, signal)` que retorna top-N memorias ordenadas por cosine similarity.
- `src/memdir/embeddings/indexStore.ts` — persistent index em `~/.andreclaw/memdir/embeddings-index.jsonl` (append-only). Metadata em `embeddings-meta.json` com provider/model/dim/version — schema mismatch invalida tudo silenciosamente.
- `findRelevantMemories.ts` **plugado**: tenta semantic ranking antes do Sonnet-selector. Se retorna >= 3 matches com score >= 0.35, usa direto e economiza tokens. Fallback transparente pro Sonnet quando indisponivel ou baixa confianca.
- Reindex lazy quando `mtimeMs` muda; forcing reset via env `ANDRECLAW_REINDEX_MEMORIES=1`.
- Bounded concurrency (4 workers) pra embedar memorias em paralelo sem overload do provider.
- `ANDRECLAW_SEMANTIC_MEMORY=off` desliga completamente pra debugging.
- `resolveHome()` usa `process.env.HOME` primeiro (permite override em testes/sandbox).
- 8 testes unitarios adicionais no `indexStore.test.ts` (schema invalidation, corrupcao silenciosa, mtime detection).

### Metricas
- 86/86 testes passando (67 security + 19 embeddings)
- Zero mudanca de comportamento default sem cliente de embeddings — Sonnet-selector segue funcionando normalmente.

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
