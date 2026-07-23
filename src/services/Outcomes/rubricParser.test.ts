import { describe, expect, test } from 'bun:test'

import { parseRubric } from './rubricParser.js'

describe('parseRubric', () => {
  test('parseia rubric completa', () => {
    const raw = `---
name: react-review
threshold: 0.8
max_iterations: 3
---

## Criterios

### funcional (peso: 2)
- Renderiza sem crash
- Handlers chamam callback correto

### testes (peso: 3)
- Cobertura >= 80%
- Nenhum test skip
`
    const r = parseRubric(raw)
    expect(r.name).toBe('react-review')
    expect(r.threshold).toBe(0.8)
    expect(r.maxIterations).toBe(3)
    expect(r.criteria).toHaveLength(2)
    expect(r.criteria[0].name).toBe('funcional')
    expect(r.criteria[0].weight).toBe(2)
    expect(r.criteria[0].checks).toEqual([
      'Renderiza sem crash',
      'Handlers chamam callback correto',
    ])
    expect(r.criteria[1].weight).toBe(3)
  })

  test('defaults quando frontmatter incompleto', () => {
    const raw = `---
name: minimal
---
### check-only
- alguma coisa
`
    const r = parseRubric(raw)
    expect(r.threshold).toBe(0.7)
    expect(r.maxIterations).toBe(3)
    expect(r.criteria[0].weight).toBe(1) // sem "(peso:)" = 1
  })

  test('threshold clamped 0..1', () => {
    const raw = `---
name: x
threshold: 5
---
### c
- check
`
    expect(parseRubric(raw).threshold).toBe(1)
  })

  test('throw sem frontmatter', () => {
    expect(() => parseRubric('sem frontmatter')).toThrow()
  })

  test('throw sem name', () => {
    expect(() => parseRubric(`---\nthreshold: 0.5\n---\n### c\n- check`)).toThrow()
  })

  test('throw sem criterios', () => {
    expect(() => parseRubric(`---\nname: x\n---\n## sem heading level 3`)).toThrow()
  })

  test('ignora criterios sem checks', () => {
    const raw = `---
name: x
---
### vazio

### com-check
- teste
`
    const r = parseRubric(raw)
    expect(r.criteria).toHaveLength(1)
    expect(r.criteria[0].name).toBe('com-check')
  })

  test('checklist com asterisco tambem funciona', () => {
    const raw = `---
name: x
---
### c
* item asterisco
- item hifen
`
    const r = parseRubric(raw)
    expect(r.criteria[0].checks).toEqual(['item asterisco', 'item hifen'])
  })
})
