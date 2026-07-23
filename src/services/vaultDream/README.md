# Vault Dream (AndreClaw Wave 4)

Consolidacao agendada de notas do vault Obsidian. Complementa o `autoDream`
existente (que consolida `~/.andreclaw/memory/`) — o Vault Dream trabalha
em `/Daily/` do vault do usuario, promovendo daily notes recorrentes a
resumos semanais em `_memory/`.

## Motivacao

Voce escreve daily notes todo dia. Depois de umas 20+, achar "o que decidi
sobre AgenzAi na semana passada" fica dificil. Vault Dream:

1. Le todas as daily notes de uma semana (segunda a domingo)
2. Detecta padroes recorrentes (mencao ao mesmo projeto, decisoes similares, blockers repetidos)
3. Gera resumo semanal em `_memory/semana-YYYY-MM-DD.md` com wikilinks pras daily originais
4. Marca daily notes como consolidadas (frontmatter `consolidatedAt: YYYY-MM-DD`)

## Como diferencia do autoDream

| Feature | autoDream | vaultDream |
|---------|-----------|------------|
| Escopo | `~/.andreclaw/memory/` (memoria de agentes) | `<vault>/Daily/` (vault do usuario) |
| Frequencia | A cada N horas (default 24h) | Semanal (domingos 22h default) |
| Output | Novos memories em `~/.andreclaw/memory/` | Resumos em `<vault>/_memory/` |
| Prompt | Consolidacao generica de sessoes | Sintese com wikilinks + backlinks bidirecionais |
| Requer vault | Nao | Sim (Obsidian) |

## Configuracao

```json
// ~/.andreclaw/settings.json
{
  "vaultDream": {
    "enabled": true,
    "vaultPath": "/Users/andrelucas/SecondBrain/andre",
    "dailyFolder": "Daily",
    "memoryFolder": "_memory",
    "cron": "0 22 * * 0",
    "minDailies": 3
  }
}
```

Env overrides:
- `ANDRECLAW_VAULT_DREAM=off` desliga
- `ANDRECLAW_VAULT_PATH=/path` override do path
- `ANDRECLAW_VAULT_DREAM_CRON=<expr>` custom cron

## Regras herdadas do CLAUDE.md do vault

- Wikilinks `[[...]]` sempre, nunca markdown links
- Frontmatter YAML valido com `type: review`, `status: ativo`, `tags: [semanal, review]`
- Callouts `> [!note]` pra observacoes
- Backlink bidirecional: resumo linka daily notes, daily notes recebem tag inversa via `consolidatedIn: [[semana-YYYY-MM-DD]]`
