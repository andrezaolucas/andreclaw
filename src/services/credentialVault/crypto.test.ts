import { describe, expect, test } from 'bun:test'
import { randomBytes } from 'crypto'

import { decrypt, encrypt, makeHint } from './crypto.js'

describe('crypto', () => {
  test('round-trip encrypt -> decrypt retorna original', () => {
    const master = randomBytes(32)
    const plain = 'sk-ant-abcdef1234567890'
    const enc = encrypt(plain, master)
    const dec = decrypt(enc, master)
    expect(dec).toBe(plain)
  })

  test('cada encrypt gera IV+salt novos', () => {
    const master = randomBytes(32)
    const plain = 'same-input'
    const e1 = encrypt(plain, master)
    const e2 = encrypt(plain, master)
    expect(e1.iv).not.toBe(e2.iv)
    expect(e1.salt).not.toBe(e2.salt)
    expect(e1.ciphertext).not.toBe(e2.ciphertext)
    // Mas ambos decodam pro mesmo valor
    expect(decrypt(e1, master)).toBe(plain)
    expect(decrypt(e2, master)).toBe(plain)
  })

  test('master key errada falha auth tag', () => {
    const m1 = randomBytes(32)
    const m2 = randomBytes(32)
    const enc = encrypt('secret', m1)
    expect(() => decrypt(enc, m2)).toThrow()
  })

  test('ciphertext tampered falha auth tag', () => {
    const master = randomBytes(32)
    const enc = encrypt('secret', master)
    const tampered = {
      ...enc,
      ciphertext: Buffer.from('tampered-data-abcd', 'utf-8').toString('base64'),
    }
    expect(() => decrypt(tampered, master)).toThrow()
  })

  test('valores unicode preservados', () => {
    const master = randomBytes(32)
    const plain = 'chave-com-café-e-🔐-emoji'
    const enc = encrypt(plain, master)
    expect(decrypt(enc, master)).toBe(plain)
  })

  test('valores grandes (>1KB)', () => {
    const master = randomBytes(32)
    const plain = 'a'.repeat(4096) + '_end'
    const enc = encrypt(plain, master)
    expect(decrypt(enc, master)).toBe(plain)
  })
})

describe('makeHint', () => {
  test('formato padrao', () => {
    expect(makeHint('sk-abc1234567890xyz9')).toBe('sk-abc***xyz9')
  })

  test('valor curto retorna ***', () => {
    expect(makeHint('short')).toBe('***')
    expect(makeHint('12345678')).toBe('***')
  })

  test('valor medio ainda mascara', () => {
    const h = makeHint('abcdefghi12345')
    // Formato: 6-primeiros + '***' + 4-ultimos = 13 chars (menor que 14 do original)
    expect(h).toBe('abcdef***2345')
    expect(h).not.toContain('ghi')
  })
})
