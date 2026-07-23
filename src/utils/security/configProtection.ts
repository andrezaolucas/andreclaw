/**
 * AgentShield-lite / Config protection
 *
 * Lista de arquivos de configuracao (linter, formatter, TS, package
 * manager) que agentes tendem a modificar em vez de corrigir o codigo.
 *
 * Uso: chamado em hook PreToolUse antes de FileEdit/FileWrite/Bash
 * (echo/sed) mirando esses arquivos. Retorna reason string se protegido.
 */

import { basename } from 'path'

/**
 * Nomes exatos (basename) de arquivos protegidos.
 */
const PROTECTED_FILES: readonly string[] = [
  // ESLint
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yml',
  '.eslintrc.yaml',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.ts',
  // Biome
  'biome.json',
  'biome.jsonc',
  // Prettier
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.js',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  'prettier.config.js',
  'prettier.config.mjs',
  // Ruff (Python)
  '.ruff.toml',
  'ruff.toml',
  // Mypy (Python)
  'mypy.ini',
  '.mypy.ini',
  // TypeScript
  'tsconfig.json',
  'tsconfig.base.json',
  // TSLint (deprecated mas ainda existe)
  'tslint.json',
  // Stylelint
  '.stylelintrc',
  '.stylelintrc.json',
  '.stylelintrc.js',
  'stylelint.config.js',
  // Rubocop
  '.rubocop.yml',
  // golangci-lint
  '.golangci.yml',
  '.golangci.yaml',
  // Editorconfig
  '.editorconfig',
]

/**
 * Retorna reason string se o arquivo estiver protegido, undefined caso contrario.
 */
export function checkConfigProtection(filePath: string): string | undefined {
  const name = basename(filePath)
  if (PROTECTED_FILES.includes(name)) {
    return (
      `Arquivo "${name}" e config protegida pelo AgentShield. ` +
      `Editar linter/formatter/TS config para pular erros e anti-padrao — ` +
      `corrija o codigo em vez de relaxar a regra. ` +
      `Se realmente precisa alterar a config, o usuario deve fazer manualmente ` +
      `ou aprovar explicitamente via prompt.`
    )
  }
  return undefined
}

/**
 * Lista imutavel dos arquivos protegidos — util pra UI de config.
 */
export function getProtectedConfigFiles(): readonly string[] {
  return PROTECTED_FILES
}
