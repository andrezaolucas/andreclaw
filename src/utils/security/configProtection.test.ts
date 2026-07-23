import { describe, expect, test } from 'bun:test'

import {
  checkConfigProtection,
  getProtectedConfigFiles,
} from './configProtection.js'

describe('checkConfigProtection', () => {
  test.each([
    '.eslintrc',
    '.eslintrc.json',
    'eslint.config.js',
    'biome.json',
    '.prettierrc',
    '.ruff.toml',
    'mypy.ini',
    'tsconfig.json',
    '.editorconfig',
    '.golangci.yml',
    '.rubocop.yml',
  ])('bloqueia arquivo protegido: %s', (name) => {
    const reason = checkConfigProtection(`/path/to/repo/${name}`)
    expect(reason).toBeDefined()
    expect(reason).toContain(name)
  })

  test.each([
    'README.md',
    'src/index.ts',
    'package.json',
    'bun.lock',
    'CHANGELOG.md',
    '.gitignore',
    'foo.js',
  ])('nao bloqueia arquivo comum: %s', (name) => {
    const reason = checkConfigProtection(`/path/to/repo/${name}`)
    expect(reason).toBeUndefined()
  })

  test('lista de arquivos protegidos tem itens', () => {
    const list = getProtectedConfigFiles()
    expect(list.length).toBeGreaterThan(10)
    expect(list).toContain('.eslintrc')
    expect(list).toContain('biome.json')
  })
})
