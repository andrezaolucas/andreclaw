# Credential Vault (AndreClaw Wave 5)

Sistema de gerenciamento de API keys de providers de LLM. Substitui
env vars soltas (`OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, etc.) por vault
encrypted em `~/.andreclaw/credentials.enc`.

## Motivacao

Bug real de 2026-07-23: usuario tinha `OPENAI_API_KEY` + `OPENAI_MODEL=deepseek-chat`
setados no shell (pra usar DeepSeek via API compatível). Isso vazou pro
AndreClaw que iniciava com "Model deepseek-chat" e falhava na primeira
mensagem. Vault resolve isso: credenciais ficam scoped por provider
sem contaminar env global.

## Providers suportados

Testados e com endpoint de healthcheck:

| Provider | Env var equivalente | Healthcheck |
|----------|--------------------|--------------|
| `openai` | `OPENAI_API_KEY` | `GET /v1/models` |
| `deepseek` | `DEEPSEEK_API_KEY` | `GET /v1/models` (api.deepseek.com) |
| `gemini` | `GEMINI_API_KEY` | `GET /v1/models` |
| `groq` | `GROQ_API_KEY` | `GET /openai/v1/models` |
| `openrouter` | `OPENROUTER_API_KEY` | `GET /api/v1/models` |
| `anthropic-key` | `ANTHROPIC_API_KEY` | `GET /v1/models` (raro — Claude Max via OAuth e preferido) |

## Encryption

- **Algoritmo**: AES-256-GCM (auth tag 16 bytes, IV 12 bytes por credential)
- **Master key derivation**:
  - **macOS**: `security add-generic-password` armazena master key no Keychain
  - **Linux**: fallback pra file em `~/.andreclaw/.master-key` (mode 0600, owner-only)
  - **Windows**: fallback file (futuro: `wincred` via nativo)
- **KDF**: HKDF-SHA256 do master + salt per-credential
- **Storage**: `~/.andreclaw/credentials.enc` (mode 0600) — JSON com envelope encriptado

## API programatica

```ts
import { vault } from '@/services/credentialVault'

// Salvar
await vault.set('deepseek', 'sk-abc123...')

// Ler (com fallback pra env var)
const key = await vault.get('deepseek')

// Listar providers autenticados (sem revelar values)
const providers = await vault.list()
// → [{ provider: 'openai', addedAt: '...', lastUsed: '...' }]

// Remover
await vault.remove('deepseek')

// Validar (healthcheck)
const ok = await vault.validate('deepseek', 'sk-abc123...')
```

## Precedencia de leitura

1. Env var especifica (ex: `OPENAI_API_KEY`) — mais alta prioridade (compat legada)
2. Vault (`vault.get('openai')`)
3. Legacy env var generica (ex: `OPENAI_API_KEY` como fallback)
4. Erro: "Provider nao configurado. Rode `/login <provider>`."

## Comandos slash (Wave 5.1 — futuro)

- `/login <provider>` — abre browser no dashboard do provider, user cola key, valida, salva
- `/logout <provider>` — remove credential
- `/whoami` — lista providers autenticados
- `/rotate <provider>` — remove + re-login
