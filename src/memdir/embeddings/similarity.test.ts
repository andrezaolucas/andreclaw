import { describe, expect, test } from 'bun:test'

import { contentHash, cosineSimilarity } from './similarity.js'

describe('cosineSimilarity', () => {
  test('vetores identicos = 1', () => {
    const v = [1, 2, 3, 4]
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5)
  })

  test('vetores ortogonais = 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5)
  })

  test('vetores opostos = -1', () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1, 5)
  })

  test('dimensoes diferentes = 0', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0)
  })

  test('vetor vazio = 0', () => {
    expect(cosineSimilarity([], [])).toBe(0)
  })

  test('vetor zero = 0 (evita NaN)', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0)
  })

  test('similaridade parcial', () => {
    // "credenciais staging" vs "credenciais producao" — vetores parecidos mas nao iguais
    const a = [0.9, 0.1, 0.5]
    const b = [0.85, 0.2, 0.4]
    const score = cosineSimilarity(a, b)
    expect(score).toBeGreaterThan(0.9) // muito similares
    expect(score).toBeLessThan(1)
  })
})

describe('contentHash', () => {
  test('mesmo conteudo = mesmo hash', () => {
    expect(contentHash('hello world')).toBe(contentHash('hello world'))
  })

  test('conteudos diferentes = hashes diferentes', () => {
    expect(contentHash('hello')).not.toBe(contentHash('hell0'))
  })

  test('string vazia tem hash estavel', () => {
    expect(contentHash('')).toBe(contentHash(''))
  })

  test('hash e string hex', () => {
    const h = contentHash('lorem ipsum')
    expect(h).toMatch(/^[0-9a-f]+$/)
  })
})
