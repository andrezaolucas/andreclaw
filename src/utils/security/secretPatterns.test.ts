import { beforeEach, describe, expect, test } from 'bun:test'

import {
  _resetSecretWhitelistCache,
  detectSecrets,
  hasSecrets,
} from './secretPatterns.js'

beforeEach(() => {
  _resetSecretWhitelistCache()
})

describe('detectSecrets — detecta padroes conhecidos', () => {
  test.each([
    ['sk-ant-abc123defghijklmnop_qrstu', 'anthropic-api-key'],
    ['sk-proj-abcdefghij1234567890XY_ZW', 'openai-api-key'],
    ['ghp_abcdefghijklmnopqrstuvwxyz1234567890', 'github-personal-token'],
    ['gho_abcdefghijklmnopqrstuvwxyz1234567890', 'github-oauth-token'],
    ['AKIAIOSFODNN7EXAMPLE', 'aws-access-key-id'],
    ['xoxb-1234567890-abcdefghij', 'slack-bot-token'],
    ['glpat-abcdefghij1234567890', 'gitlab-personal-access-token'],
    ['ya29.a0AfH6SMBExample_Token_Here', 'google-oauth-access-token'],
    ['sk_live_abcdefghijklmnop1234567890', 'stripe-secret-key'],
  ])('detecta %s (padrao: %s)', (secret, patternName) => {
    const findings = detectSecrets(`config value is ${secret} in log`)
    expect(findings.length).toBeGreaterThan(0)
    expect(findings.some(f => f.patternName === patternName)).toBe(true)
  })

  test('detecta PEM private key', () => {
    const pem = `-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----`
    const findings = detectSecrets(pem)
    expect(findings.length).toBeGreaterThan(0)
    expect(findings.some(f => f.patternName === 'private-key-pem')).toBe(true)
  })

  test('detecta JWT', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    const findings = detectSecrets(jwt)
    expect(findings.length).toBeGreaterThan(0)
    expect(findings.some(f => f.patternName === 'jwt')).toBe(true)
  })
})

describe('detectSecrets — nao detecta strings comuns', () => {
  test.each([
    'const foo = "hello world"',
    'sk-short', // muito curto pra ser api key
    'ghp_TOO_SHORT',
    'AKIA_INVALID', // faltam chars
    'password=1234', // sem padrao conhecido
    'const apiKey = process.env.API_KEY',
    'my birthday is 1990-01-01',
  ])('nao detecta: %s', (input) => {
    const findings = detectSecrets(input)
    expect(findings).toEqual([])
  })

  test('hasSecrets false pra string vazia', () => {
    expect(hasSecrets('')).toBe(false)
  })

  test('hasSecrets true pra secret', () => {
    expect(hasSecrets('token=ghp_abcdefghijklmnopqrstuvwxyz1234567890')).toBe(true)
  })
})
