/**
 * AndreClaw — Interactive Provider Setup Wizard
 *
 * Runs on first launch when no provider is configured.
 * Guides the user through choosing a provider, entering API key,
 * and selecting a model. Saves the config to .andreclaw-profile.json
 * so it persists across sessions.
 */

import { createInterface } from 'readline'
import { homedir } from 'os'
import { join } from 'path'
import { writeFileSync, existsSync, readFileSync } from 'fs'
import {
  type ProfileFile,
  type ProviderProfile,
  type ProfileEnv,
  loadProfileFile,
  hasExplicitProviderSelection,
  PROFILE_FILE_NAME,
} from './providerProfile.js'

const ESC = '\x1b['
const RESET = `${ESC}0m`
const BOLD = `${ESC}1m`
const DIM = `${ESC}2m`
const GREEN = `${ESC}32m`
const YELLOW = `${ESC}33m`
const CYAN = `${ESC}36m`
const WHITE = `${ESC}37m`

interface ProviderOption {
  name: string
  value: ProviderProfile | 'openrouter' | 'deepseek' | 'groq'
  description: string
  needsKey: boolean
  defaultModel: string
  models: { name: string; description: string }[]
  baseUrl?: string
  envFlag?: string
}

const PROVIDERS: ProviderOption[] = [
  {
    name: 'OpenAI (ChatGPT)',
    value: 'openai',
    description: 'GPT-4o, GPT-4o-mini — precisa de chave da OpenAI',
    needsKey: true,
    defaultModel: 'gpt-4o',
    models: [
      { name: 'gpt-4o', description: 'Melhor geral' },
      { name: 'gpt-4o-mini', description: 'Rapido e barato' },
      { name: 'gpt-4.1', description: 'Mais recente' },
    ],
  },
  {
    name: 'Ollama (local, gratis!)',
    value: 'ollama',
    description: 'Roda no seu PC, sem internet, sem custo',
    needsKey: false,
    defaultModel: 'llama3.2:3b',
    baseUrl: 'http://localhost:11434/v1',
    models: [
      { name: 'llama3.2:3b', description: 'Leve e rapido (4GB RAM)' },
      { name: 'qwen2.5-coder:7b', description: 'Otimo pra codigo (8GB RAM)' },
      { name: 'llama3.2', description: 'Uso geral (8GB RAM)' },
    ],
  },
  {
    name: 'Google Gemini',
    value: 'gemini',
    description: 'Gemini Flash — tem plano gratis!',
    needsKey: true,
    defaultModel: 'gemini-2.0-flash',
    envFlag: 'CLAUDE_CODE_USE_GEMINI',
    models: [
      { name: 'gemini-2.0-flash', description: 'Melhor geral (gratis com limites)' },
      { name: 'gemini-2.0-flash-lite', description: 'Mais rapido' },
    ],
  },
  {
    name: 'OpenRouter (200+ modelos)',
    value: 'openrouter',
    description: 'Uma chave, centenas de modelos — tem modelos gratis!',
    needsKey: true,
    defaultModel: 'qwen/qwen3.6-plus:free',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      { name: 'qwen/qwen3.6-plus:free', description: 'Gratis!' },
      { name: 'google/gemini-2.0-flash-exp:free', description: 'Gemini gratis' },
      { name: 'anthropic/claude-sonnet-4', description: 'Claude (pago)' },
    ],
  },
  {
    name: 'DeepSeek',
    value: 'deepseek',
    description: 'DeepSeek-V3 — barato e muito bom',
    needsKey: true,
    defaultModel: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      { name: 'deepseek-chat', description: 'DeepSeek-V3 (melhor geral)' },
      { name: 'deepseek-reasoner', description: 'DeepSeek-R1 (raciocinio)' },
    ],
  },
  {
    name: 'Groq (rapido e gratis!)',
    value: 'groq',
    description: 'Modelos open-source com velocidade absurda',
    needsKey: true,
    defaultModel: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      { name: 'llama-3.3-70b-versatile', description: 'Melhor geral' },
      { name: 'llama-3.1-8b-instant', description: 'Ultra rapido' },
    ],
  },
]

function createReadline(): ReturnType<typeof createInterface> {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

function question(rl: ReturnType<typeof createInterface>, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim())
    })
  })
}

async function selectProvider(rl: ReturnType<typeof createInterface>): Promise<ProviderOption | null> {
  console.log('')
  console.log(`${BOLD}${CYAN}  Escolha seu provedor de IA:${RESET}`)
  console.log('')

  for (let i = 0; i < PROVIDERS.length; i++) {
    const p = PROVIDERS[i]
    console.log(`  ${GREEN}${i + 1})${RESET} ${BOLD}${p.name}${RESET}`)
    console.log(`     ${DIM}${p.description}${RESET}`)
  }

  console.log('')
  console.log(`  ${DIM}0) Pular — ja tenho configurado / vou configurar depois${RESET}`)
  console.log('')

  while (true) {
    const answer = await question(rl, `  ${WHITE}Digite o numero (0-${PROVIDERS.length}): ${RESET}`)
    const lower = answer.toLowerCase()
    if (lower === '0' || lower === 'sair' || lower === 'pular' || lower === 'skip' || lower === 'exit') {
      return null
    }
    const num = parseInt(answer, 10)
    if (num >= 1 && num <= PROVIDERS.length) {
      return PROVIDERS[num - 1]
    }
    console.log(`  ${YELLOW}Numero invalido. Digite 1-${PROVIDERS.length} ou 0 pra pular.${RESET}`)
  }
}

async function getApiKey(rl: ReturnType<typeof createInterface>, provider: ProviderOption): Promise<string> {
  console.log('')

  const hints: Record<string, string> = {
    openai: 'Pegue em: https://platform.openai.com/api-keys',
    gemini: 'Pegue em: https://aistudio.google.com/apikey',
    openrouter: 'Pegue em: https://openrouter.ai/keys',
    deepseek: 'Pegue em: https://platform.deepseek.com/api_keys',
    groq: 'Pegue em: https://console.groq.com/keys',
  }

  const hint = hints[provider.value] || ''
  if (hint) {
    console.log(`  ${DIM}${hint}${RESET}`)
  }

  while (true) {
    const key = await question(rl, `  ${WHITE}Cole sua chave de API: ${RESET}`)
    if (key.length > 5) {
      return key
    }
    console.log(`  ${YELLOW}Chave muito curta. Verifique e tente de novo.${RESET}`)
  }
}

async function selectModel(rl: ReturnType<typeof createInterface>, provider: ProviderOption): Promise<string> {
  console.log('')
  console.log(`  ${BOLD}${CYAN}Escolha o modelo:${RESET}`)
  console.log('')

  for (let i = 0; i < provider.models.length; i++) {
    const m = provider.models[i]
    const isDefault = m.name === provider.defaultModel ? ` ${GREEN}(recomendado)${RESET}` : ''
    console.log(`  ${GREEN}${i + 1})${RESET} ${BOLD}${m.name}${RESET}${isDefault}`)
    console.log(`     ${DIM}${m.description}${RESET}`)
  }

  console.log('')

  const answer = await question(rl, `  ${WHITE}Numero ou Enter pro recomendado: ${RESET}`)

  if (!answer) {
    return provider.defaultModel
  }

  const num = parseInt(answer, 10)
  if (num >= 1 && num <= provider.models.length) {
    return provider.models[num - 1].name
  }

  return provider.defaultModel
}

function saveProfile(provider: ProviderOption, apiKey: string | null, model: string): void {
  const profilePath = join(homedir(), PROFILE_FILE_NAME)

  let profile: ProviderProfile
  const env: ProfileEnv = {}

  if (provider.value === 'gemini') {
    profile = 'gemini'
    env.GEMINI_API_KEY = apiKey || undefined
    env.GEMINI_MODEL = model
  } else if (provider.value === 'ollama') {
    profile = 'ollama'
    env.OPENAI_BASE_URL = provider.baseUrl
    env.OPENAI_MODEL = model
  } else {
    profile = 'openai'
    env.OPENAI_API_KEY = apiKey || undefined
    env.OPENAI_MODEL = model
    if (provider.baseUrl) {
      env.OPENAI_BASE_URL = provider.baseUrl
    }
  }

  const profileFile: ProfileFile = {
    profile,
    env,
    createdAt: new Date().toISOString(),
  }

  writeFileSync(profilePath, JSON.stringify(profileFile, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  })
}

function applyToProcessEnv(provider: ProviderOption, apiKey: string | null, model: string): void {
  if (provider.value === 'gemini') {
    process.env.CLAUDE_CODE_USE_GEMINI = '1'
    if (apiKey) process.env.GEMINI_API_KEY = apiKey
    process.env.GEMINI_MODEL = model
  } else {
    process.env.CLAUDE_CODE_USE_OPENAI = '1'
    if (apiKey) process.env.OPENAI_API_KEY = apiKey
    process.env.OPENAI_MODEL = model
    if (provider.baseUrl) {
      process.env.OPENAI_BASE_URL = provider.baseUrl
    }
  }
}

/**
 * Returns true if the wizard should run:
 * - No explicit provider env vars set
 * - No saved profile file
 * - No Anthropic API key
 * - Running in a TTY (interactive terminal)
 */
export function shouldRunSetupWizard(): boolean {
  if (!process.stdout.isTTY || !process.stdin.isTTY) return false
  if (process.env.CI) return false
  if (hasExplicitProviderSelection()) return false
  if (process.env.ANTHROPIC_API_KEY) return false

  // Check if user already completed Anthropic onboarding (has OAuth or API key configured)
  // Uses getGlobalClaudeFile() which respects CLAUDE_CONFIG_DIR
  try {
    const { getGlobalClaudeFile } = require('./env.js')
    const claudeConfigPath = getGlobalClaudeFile()
    if (existsSync(claudeConfigPath)) {
      const config = JSON.parse(readFileSync(claudeConfigPath, 'utf8'))
      if (config.hasCompletedOnboarding || config.oauthAccount || config.primaryApiKey) {
        return false
      }
    }
  } catch {
    // Ignore parse errors
  }

  // Fallback: also check the default ~/.claude.json for users with Claude Code installed
  try {
    const defaultConfigPath = join(homedir(), '.claude.json')
    if (existsSync(defaultConfigPath)) {
      const config = JSON.parse(readFileSync(defaultConfigPath, 'utf8'))
      if (config.hasCompletedOnboarding || config.oauthAccount || config.primaryApiKey) {
        return false
      }
    }
  } catch {
    // Ignore parse errors
  }

  // Check for profile in home dir and current dir
  const homeProfile = join(homedir(), PROFILE_FILE_NAME)
  const cwdProfile = join(process.cwd(), PROFILE_FILE_NAME)
  if (existsSync(homeProfile) || existsSync(cwdProfile)) return false

  // Also check if loadProfileFile finds anything
  if (loadProfileFile()) return false

  return true
}

/**
 * Runs the interactive provider setup wizard.
 * Returns true if setup was completed, false if cancelled.
 */
export async function runSetupWizard(): Promise<boolean> {
  const rl = createReadline()

  try {
    console.log('')
    console.log(`${BOLD}${GREEN}  ========================================${RESET}`)
    console.log(`${BOLD}${GREEN}    Bem-vindo ao AndreClaw!${RESET}`)
    console.log(`${BOLD}${GREEN}  ========================================${RESET}`)
    console.log('')
    console.log(`  ${WHITE}Vamos configurar seu provedor de IA.${RESET}`)
    console.log(`  ${DIM}Isso so precisa ser feito uma vez.${RESET}`)

    const provider = await selectProvider(rl)
    if (!provider) {
      console.log('')
      console.log(`  ${DIM}Pulado. Configure manualmente com variaveis de ambiente ou rode andreclaw de novo.${RESET}`)
      console.log('')
      rl.close()
      return true // Return true so CLI continues normally (falls through to Anthropic onboarding)
    }

    let apiKey: string | null = null

    if (provider.needsKey) {
      apiKey = await getApiKey(rl, provider)
    } else if (provider.value === 'ollama') {
      console.log('')
      console.log(`  ${DIM}Certifique-se que o Ollama esta rodando.${RESET}`)
      console.log(`  ${DIM}Se nao tem o modelo, rode: ollama pull ${provider.defaultModel}${RESET}`)
    }

    const model = await selectModel(rl, provider)

    // Save and apply
    saveProfile(provider, apiKey, model)
    applyToProcessEnv(provider, apiKey, model)

    console.log('')
    console.log(`${BOLD}${GREEN}  Configuracao salva!${RESET}`)
    console.log('')
    console.log(`  ${WHITE}Provedor:${RESET} ${BOLD}${provider.name}${RESET}`)
    console.log(`  ${WHITE}Modelo:${RESET}   ${BOLD}${model}${RESET}`)
    console.log(`  ${DIM}Salvo em: ~/${PROFILE_FILE_NAME}${RESET}`)
    console.log(`  ${DIM}Pra mudar depois, delete o arquivo e rode andreclaw de novo.${RESET}`)
    console.log('')

    rl.close()
    return true
  } catch (err) {
    rl.close()
    // User cancelled (Ctrl+C) or error
    return false
  }
}
