# Outcomes Framework (AndreClaw Wave 4)

Sistema local de rubric-based validation. Inspirado no [Outcomes da Anthropic](https://platform.claude.com/docs/en/managed-agents/define-outcomes) mas **100% local** — sem Managed Agents API.

## Motivacao

Como saber se o output de um agente atingiu qualidade suficiente pra entrega?
Hoje o julgamento e do humano (ou do agente auto-avaliando com bias). Outcomes
formaliza isso com criterios declarativos.

## Como funciona

1. Voce define uma **rubric** em markdown com criterios de aceite
2. Ao final de uma task, o Outcomes chama um **grader** (Sonnet em context
   isolado) que ve so o artefato + rubric — sem historico
3. Grader retorna pass/fail por criterio + score global
4. Se falha, loop de refinamento (max N iteracoes) antes de escalar pro user

## Rubric exemplo

```markdown
---
name: react-component-review
threshold: 0.8
max_iterations: 3
---

## Criterios

### funcional (peso: 2)
- Renderiza sem crash com props minimas
- Todos handlers de evento chamam o callback correto

### testes (peso: 3)
- Cobertura >= 80% (executar `bun test --coverage`)
- Nenhum test skip/xit
- Casos edge cobertos (null, undefined, array vazio)

### style (peso: 1)
- Sem `any` sem justificativa
- Componentes acima de 100 linhas foram extraidos
- Nenhum inline style
```

## API programatica

```ts
import { runOutcome } from './runOutcome.js'

const result = await runOutcome({
  rubricPath: '.andreclaw/rubrics/react-component-review.md',
  artifactPath: 'src/components/Button.tsx',
  signal,
})

if (result.passed) {
  console.log(`✅ Score: ${result.score.toFixed(2)}`)
} else {
  console.log(`❌ Falhou em: ${result.failedCriteria.map(c => c.name).join(', ')}`)
  console.log(`Feedback: ${result.feedback}`)
}
```

## Metricas persistentes

Cada execucao vai pra `~/.andreclaw/outcomes/outcomes.jsonl`:

```json
{
  "ts": "2026-07-23T22:30:00Z",
  "rubric": "react-component-review",
  "artifact": "src/components/Button.tsx",
  "score": 0.87,
  "passed": true,
  "iterations": 1,
  "durationMs": 4213
}
```

Usar `outcomes-stats` (futuro CLI) pra ver tendencia de qualidade.

## Kill switch

`ANDRECLAW_OUTCOMES=off` desliga completamente.
