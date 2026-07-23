# Semantic Memory Search (opcional)

Plugin de embeddings **opcional** que complementa (nao substitui) o
Sonnet-based selector em `findRelevantMemories.ts`.

## Quando usar
- Voce tem 50+ memorias em `~/.andreclaw/memory/` e o Sonnet-selector fica
  gastando tokens pra escanear cabecalhos toda query.
- Voce quer semantic ranking real (nao so keyword nem heuristica name-based).

## Providers suportados

Detectado automaticamente na ordem:

1. **Ollama** local (`nomic-embed-text` ou `bge-m3`). Zero-cost, offline.
2. **OpenAI** (`text-embedding-3-small`) se `OPENAI_API_KEY` disponivel.
3. **Fallback**: retorna vazio — o Sonnet-selector continua funcionando.

## Configuracao

```bash
# Opcional: forcar provider especifico
export ANDRECLAW_EMBEDDINGS_PROVIDER=ollama   # ou 'openai' | 'off'
export ANDRECLAW_EMBEDDINGS_MODEL=nomic-embed-text  # override modelo

# Reindex forcado
ANDRECLAW_REINDEX_MEMORIES=1 andreclaw
```

## Storage

- Index em `~/.andreclaw/memdir/embeddings-index.jsonl` (append-only)
- Cada linha: `{ path, mtimeMs, hash, vec: [float32...] }`
- Rebuild automatico quando `mtimeMs` do arquivo muda
- Sem migracao — se schema muda, deleta `.jsonl` e rebuild

## Custo

- Ollama local: 0 tokens/query
- OpenAI text-embedding-3-small: ~$0.02/M tokens (praticamente free em uso pessoal)

## Integracao com o selector existente

```ts
// findRelevantMemories.ts
const semanticMatches = await semanticSearch(query, memories)
if (semanticMatches.length >= 3) return semanticMatches  // confia
// senao, fallback pro Sonnet-selector normal
```
