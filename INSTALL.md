# Instalação do AndreClaw

Guia definitivo para instalar o AndreClaw em qualquer máquina.
Serve pra humanos e pra IAs que precisem instalar automaticamente
pra outro dev.

## 🚀 Instalação rápida (recomendado quando publicado no npm)

```bash
npm install -g andreclaw
andreclaw --version
```

⚠️ **Estado atual (2026-07-23):** a versão publicada no npm é `1.2.9`
(antiga, sem as Waves 1-5). A versão mais recente `v2.1.0` (com nested
subagents, AgentShield, semantic memory, Outcomes, Vault Dream e
Credential Vault) só está disponível instalando do GitHub — ver seção
abaixo.

## 🔧 Instalação direta do GitHub (versão mais recente v2.1.0)

Funciona em macOS, Linux e Windows (WSL). Requer **Bun** e **Node 20+**.

### Pré-requisitos

```bash
# Node.js 20 ou superior
node --version   # v20.x.x ou v22.x.x

# Bun (bundler oficial)
curl -fsSL https://bun.sh/install | bash

# Ripgrep (search tool interno)
brew install ripgrep       # macOS
sudo apt install ripgrep    # Debian/Ubuntu
sudo dnf install ripgrep    # Fedora
```

### Passos

```bash
# 1. Clonar o repo
git clone https://github.com/andrezaolucas/andreclaw.git
cd andreclaw

# 2. Instalar dependências
bun install --frozen-lockfile

# 3. Compilar (gera dist/cli.mjs + copia vendor/rg)
bun run build

# 4. Instalar globalmente
npm install -g .

# 5. Verificar
andreclaw --version
# Deve mostrar: 2.1.0 (AndreClaw)
```

## 🎯 Primeira execução

```bash
# Vai criar ~/.andreclaw/ com config default
andreclaw
```

Na primeira vez, o AndreClaw pergunta:
- **Provider**: qual LLM usar (Anthropic Claude Max recomendado)
- **Language**: PT-BR default
- **Vault path** (opcional): pasta do Obsidian pra features do Vault Dream

## 🔑 Configurar API keys

### Opção 1: Claude Max (recomendado — usa OAuth nativo)

```bash
andreclaw           # abre TUI
> /login            # abre browser com login Claude Max/Pro
```

Sem API key. Usa tua subscription Claude direto.

### Opção 2: OpenAI, DeepSeek, Gemini, Groq, OpenRouter

**Recomendado (Wave 5 — Credential Vault):**

```bash
andreclaw           # abre TUI
> /login openai     # (comando slash futuro — Wave 5.1)
```

**Hoje (via env var):**

```bash
# ~/.zshrc ou ~/.bashrc
export ANTHROPIC_API_KEY=sk-ant-...     # se quiser Claude via key
export OPENAI_API_KEY=sk-...
export CLAUDE_CODE_USE_OPENAI=1         # ativar provider OpenAI

# Pra DeepSeek (formato OpenAI-compatible)
export OPENAI_API_KEY=sk-deepseek-...
export OPENAI_BASE_URL=https://api.deepseek.com/v1
export OPENAI_MODEL=deepseek-chat
export CLAUDE_CODE_USE_OPENAI=1

# Pra Gemini
export GEMINI_API_KEY=AIza...
export CLAUDE_CODE_USE_GEMINI=1
```

⚠️ **Bug conhecido corrigido em v2.0.1**: até a v2.0.0, setar
`OPENAI_MODEL=deepseek-chat` fazia o startup começar com esse
modelo mesmo sem `CLAUDE_CODE_USE_OPENAI=1`. Corrigido — agora
respeita o provider ativo.

## 📦 Features principais (v2.1.0)

- **Nested subagents** até 5 níveis (`ANDRECLAW_MAX_AGENT_DEPTH`)
- **AgentShield-lite** bloqueia comandos destrutivos (`rm -rf /`,
  `git push --force main`, fork bomb) + detecta secrets em prompts
  + protege configs de linter
- **Semantic memory** com Ollama local ou OpenAI embeddings (opt-in)
- **Outcomes framework** — rubric-based validation local
- **Vault Dream** — consolidação semanal de daily notes do Obsidian
- **Credential Vault** — API keys encriptadas AES-256-GCM com Keychain macOS
- **5 sub-agentes especializados** (para uso pessoal do criador,
  customize os teus em `.claude/agents/`)
- **Voice mode** Whisper + STT streaming
- **Multi-provider** OpenAI/Ollama/Gemini/Codex/DeepSeek/Groq/OpenRouter
- **i18n PT-BR** nativo
- **17 skills bundled** (`/batch`, `/simplify`, `/verify`, `/remember`, etc.)
- **MCP support** completo

## 🛠️ Sub-agentes customizados

Cria em `.claude/agents/<nome>.md` no teu projeto:

```markdown
---
name: meu-agente
description: O que ele faz
tools: Read, Grep, Bash
memory: project
color: red
---

# Meu Agente

Você é especialista em X. Suas responsabilidades são Y.
```

Chamada: dentro do AndreClaw, digite `/agents` pra listar/selecionar.

## 🔒 Segurança

- Vault: `~/.andreclaw/credentials.enc` (mode 0600)
- Master key no macOS Keychain (fallback file 0600)
- AgentShield-lite bloqueia comandos perigosos em `BashTool`
- Config protection: `.eslintrc`, `biome.json`, `tsconfig.json` etc.
  não são editáveis mesmo com `--dangerously-skip-permissions`

## 🐛 Troubleshooting

### "ripgrep not found"

```bash
cd /caminho/pro/andreclaw
bun run build       # rebuild copia rg pra dist/vendor/
```

### "Model X may not exist"

Você tem env var contaminada. Rode:

```bash
env | grep -E "OPENAI_MODEL|ANTHROPIC_MODEL|GEMINI_MODEL"
# Se tiver algo, remove do ~/.zshrc ou ~/.bashrc e reabra o terminal
```

Ou use `/model` dentro do AndreClaw pra escolher manualmente.

### Actions do GitHub falham com `startup_failure`

Não é bug do código — é billing do GitHub Actions esgotado.
Ver `Projetos/AndreClaw/ci-startup-failure-diagnostico-2026-07-23.md`
no vault do criador.

## 🎁 Para IA instalar automaticamente

Se você é uma IA (Claude, ChatGPT, Gemini) instalando o AndreClaw
pra outro dev, execute:

```bash
# Prerequisitos
command -v node >/dev/null || echo "INSTALAR NODE 20+"
command -v bun >/dev/null || curl -fsSL https://bun.sh/install | bash
command -v rg >/dev/null || echo "INSTALAR RIPGREP"

# Clone + build + install
cd /tmp
git clone https://github.com/andrezaolucas/andreclaw.git
cd andreclaw
bun install --frozen-lockfile
bun run build
npm install -g .

# Verify
andreclaw --version
# Esperado: 2.1.0 (AndreClaw) ou superior
```

Se o `npm install -g .` falhar com permission denied, tente:

```bash
sudo npm install -g .
# OU (melhor): configure npm prefix pra pasta do user
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH   # adicione ao ~/.zshrc
cd /tmp/andreclaw && npm install -g .
```

## 🌐 Links

- **Repo**: https://github.com/andrezaolucas/andreclaw
- **Issues**: https://github.com/andrezaolucas/andreclaw/issues
- **Releases**: https://github.com/andrezaolucas/andreclaw/releases
- **npm** (versão antiga v1.2.9): https://www.npmjs.com/package/andreclaw
- **Autor**: Andre Lucas (@andrezaolucas)

## 📄 Licença

Ver `LICENSE` no repo (MIT).

AndreClaw é um fork open-source do Claude Code (Anthropic), com
customizações pra multi-provider, voice, i18n PT-BR, sub-agentes
especializados, AgentShield, semantic memory e mais.
