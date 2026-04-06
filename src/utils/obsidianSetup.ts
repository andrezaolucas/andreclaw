/**
 * AndreClaw — Obsidian Second Brain Setup
 *
 * Runs after provider setup on first launch.
 * Detects Obsidian, offers to install it, and creates the full
 * vault structure (ANDRECLAW.md, .andreclaw/, commands, rules, etc.)
 */

import { createInterface, type Interface } from 'readline'
import { homedir, platform } from 'os'
import { join, basename } from 'path'
import {
  writeFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from 'fs'
import { execSync, spawnSync } from 'child_process'

const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'
const WHITE = '\x1b[37m'
const DIM = '\x1b[2m'

function createReadline(): Interface {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

function ask(rl: Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()))
  })
}

// ─── Detection ───────────────────────────────────────────────────────

function isInsideObsidianVault(dir: string): boolean {
  return existsSync(join(dir, '.obsidian'))
}

function hasAndreclawSetup(dir: string): boolean {
  return existsSync(join(dir, 'ANDRECLAW.md')) || existsSync(join(dir, 'CLAUDE.md'))
}

function isObsidianInstalled(): boolean {
  const os = platform()
  if (os === 'darwin') {
    return existsSync('/Applications/Obsidian.app')
  } else if (os === 'win32') {
    try {
      const result = spawnSync('where', ['obsidian'], { encoding: 'utf8' })
      return result.status === 0
    } catch {
      return false
    }
  } else {
    try {
      const result = spawnSync('which', ['obsidian'], { encoding: 'utf8' })
      if (result.status === 0) return true
      // Check snap/flatpak
      return existsSync('/snap/obsidian/current') ||
        existsSync('/var/lib/flatpak/app/md.obsidian.Obsidian')
    } catch {
      return false
    }
  }
}

// ─── Install Obsidian ────────────────────────────────────────────────

function installObsidian(): boolean {
  const os = platform()
  console.log('')
  console.log(`  ${CYAN}Instalando Obsidian...${RESET}`)
  console.log('')

  try {
    if (os === 'darwin') {
      console.log(`  ${DIM}brew install --cask obsidian${RESET}`)
      execSync('brew install --cask obsidian', { stdio: 'inherit' })
    } else if (os === 'win32') {
      console.log(`  ${DIM}winget install Obsidian.Obsidian${RESET}`)
      execSync('winget install Obsidian.Obsidian --accept-source-agreements --accept-package-agreements', { stdio: 'inherit' })
    } else {
      // Try snap first, then flatpak
      try {
        console.log(`  ${DIM}snap install obsidian --classic${RESET}`)
        execSync('sudo snap install obsidian --classic', { stdio: 'inherit' })
      } catch {
        console.log(`  ${DIM}flatpak install -y flathub md.obsidian.Obsidian${RESET}`)
        execSync('flatpak install -y flathub md.obsidian.Obsidian', { stdio: 'inherit' })
      }
    }
    console.log('')
    console.log(`  ${GREEN}Obsidian instalado com sucesso!${RESET}`)
    return true
  } catch {
    console.log('')
    console.log(`  ${YELLOW}Nao consegui instalar automaticamente.${RESET}`)
    console.log(`  ${DIM}Baixe manualmente em: https://obsidian.md/download${RESET}`)
    return false
  }
}

// ─── Obsidian Internal Config ────────────────────────────────────────

function configureObsidianSettings(vaultPath: string): void {
  const obsidianDir = join(vaultPath, '.obsidian')
  if (!existsSync(obsidianDir)) mkdirSync(obsidianDir, { recursive: true })

  // Pasta de attachments
  const attachmentsDir = join(vaultPath, 'Recursos', 'attachments')
  if (!existsSync(attachmentsDir)) mkdirSync(attachmentsDir, { recursive: true })

  // app.json — configs essenciais
  const appConfigPath = join(obsidianDir, 'app.json')
  let appConfig: Record<string, unknown> = {}
  if (existsSync(appConfigPath)) {
    try { appConfig = JSON.parse(readFileSync(appConfigPath, 'utf8')) } catch {}
  }
  Object.assign(appConfig, {
    useMarkdownLinks: false,           // forca wikilinks (recomendacao kepano)
    newLinkFormat: 'shortest',         // links curtos
    alwaysUpdateLinks: true,           // atualiza links ao renomear
    newFileLocation: 'folder',         // novas notas na Inbox
    newFileFolderPath: 'Inbox',
    attachmentFolderPath: 'Recursos/attachments',
    trashOption: 'local',              // delete vai pro .trash
    spellcheckLanguages: ['pt-BR'],
    showLineNumber: true,
    promptDelete: true,                // confirmacao antes de deletar
    livePreview: true,                 // live preview (padrao moderno)
    readableLineLength: true,          // largura confortavel de leitura
    strictLineBreaks: false,           // quebras de linha flexiveis
    foldHeading: true,                 // permite dobrar headings
    foldIndent: true,                  // permite dobrar indentacoes
    showFrontmatter: true,             // mostra frontmatter YAML
    autoConvertHtml: true,             // converte HTML pra markdown
    defaultViewMode: 'source',         // modo source por padrao
    spellcheck: true,                  // spellcheck ativado
  })
  writeFileSync(appConfigPath, JSON.stringify(appConfig, null, 2), 'utf8')

  // daily-notes.json — config do plugin Daily Notes
  const dailyNotesPath = join(obsidianDir, 'daily-notes.json')
  writeFileSync(dailyNotesPath, JSON.stringify({
    folder: 'Daily',
    format: 'YYYY-MM-DD',
    template: 'Templates/daily-note.md',
    autorun: false,
  }, null, 2), 'utf8')

  // templates.json — config do plugin Templates
  const templatesPath = join(obsidianDir, 'templates.json')
  writeFileSync(templatesPath, JSON.stringify({
    folder: 'Templates',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm',
  }, null, 2), 'utf8')

  // core-plugins.json — ativar plugins uteis
  const corePluginsPath = join(obsidianDir, 'core-plugins.json')
  let corePlugins: string[] = []
  if (existsSync(corePluginsPath)) {
    try { corePlugins = JSON.parse(readFileSync(corePluginsPath, 'utf8')) } catch {}
  }
  // core-plugins.json — formato objeto {nome: true/false} (padrao Obsidian)
  const corePluginsConfig: Record<string, boolean> = {
    'file-explorer': true,
    'global-search': true,
    'switcher': true,
    'graph': true,
    'backlink': true,
    'canvas': true,
    'outgoing-link': true,
    'tag-pane': true,
    'properties': false,
    'page-preview': true,
    'daily-notes': true,
    'templates': true,
    'note-composer': true,
    'command-palette': true,
    'slash-command': true,
    'editor-status': true,
    'bookmarks': true,
    'markdown-importer': false,
    'zk-prefixer': false,
    'random-note': false,
    'outline': true,
    'word-count': true,
    'slides': false,
    'audio-recorder': false,
    'workspaces': true,
    'file-recovery': true,
    'publish': false,
    'sync': true,
    'webviewer': false,
    'footnotes': false,
    'bases': true,
  }
  // Merge: preserva configs existentes, adiciona as que faltam
  if (existsSync(corePluginsPath)) {
    try {
      const existing = JSON.parse(readFileSync(corePluginsPath, 'utf8'))
      if (typeof existing === 'object' && !Array.isArray(existing)) {
        Object.assign(corePluginsConfig, existing)
      }
    } catch {}
  }
  writeFileSync(corePluginsPath, JSON.stringify(corePluginsConfig, null, 2), 'utf8')

  // graph.json — config otimizada do grafo
  const graphPath = join(obsidianDir, 'graph.json')
  if (!existsSync(graphPath)) {
    writeFileSync(graphPath, JSON.stringify({
      'collapse-filter': true,
      search: '',
      showTags: false,
      showAttachments: false,
      hideUnresolved: false,
      showOrphans: true,
      'collapse-color-groups': true,
      colorGroups: [],
      'collapse-display': true,
      showArrow: false,
      textFadeMultiplier: 0,
      nodeSizeMultiplier: 1,
      lineSizeMultiplier: 1,
      'collapse-forces': true,
      centerStrength: 0.52,
      repelStrength: 10,
      linkStrength: 1,
      linkDistance: 250,
      scale: 0.43,
      close: true,
    }, null, 2), 'utf8')
  }

  // community-plugins.json — plugins recomendados
  const communityPluginsPath = join(obsidianDir, 'community-plugins.json')
  const recommendedPlugins = [
    'templater-obsidian',    // templates avancados
    'dataview',              // queries no vault
    'obsidian-git',          // backup automatico
    'open-in-terminal',      // terminal no vault
  ]
  let communityPlugins: string[] = []
  if (existsSync(communityPluginsPath)) {
    try { communityPlugins = JSON.parse(readFileSync(communityPluginsPath, 'utf8')) } catch {}
  }
  for (const p of recommendedPlugins) {
    if (!communityPlugins.includes(p)) communityPlugins.push(p)
  }
  writeFileSync(communityPluginsPath, JSON.stringify(communityPlugins, null, 2), 'utf8')

  // templater config — trigger on file creation
  const templaterDir = join(obsidianDir, 'plugins', 'templater-obsidian')
  if (!existsSync(templaterDir)) mkdirSync(templaterDir, { recursive: true })
  const templaterConfigPath = join(templaterDir, 'data.json')
  if (!existsSync(templaterConfigPath)) {
    writeFileSync(templaterConfigPath, JSON.stringify({
      template_folder: 'Templates',
      trigger_on_file_creation: true,
    }, null, 2), 'utf8')
  }
}

// ─── Create Vault Structure ──────────────────────────────────────────

function createFile(path: string, content: string): void {
  const dir = join(path, '..')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  if (!existsSync(path)) {
    writeFileSync(path, content, 'utf8')
  }
}

function createVaultStructure(vaultPath: string, userName: string, userStack: string): void {
  // Folders
  const folders = ['Daily', 'Projetos', 'Recursos', 'Goals', 'Inbox', 'Ideias', 'Pessoas', 'Templates', '_memory']
  for (const folder of folders) {
    const folderPath = join(vaultPath, folder)
    if (!existsSync(folderPath)) mkdirSync(folderPath, { recursive: true })

    const indexDescriptions: Record<string, string> = {
      'Daily': 'Notas diarias no formato YYYY-MM-DD',
      'Projetos': 'Documentacao, decisoes e status de cada projeto',
      'Recursos': 'Aprendizados, tutoriais, referencias tecnicas',
      'Goals': 'Cascata de objetivos (visao 3 anos → anual → trimestral)',
      'Inbox': 'Captura rapida — processar e mover para pasta correta',
      'Ideias': 'Ideias brutas, insights, coisas pra explorar',
      'Pessoas': 'Contatos, parceiros, contexto de relacionamentos profissionais',
      'Templates': 'Templates para daily notes, projetos, reunioes',
      '_memory': 'Resumos de sessoes anteriores (gerado por /handover)',
    }

    createFile(join(folderPath, '_index.md'), `---
type: recurso
created: ${new Date().toISOString().slice(0, 10)}
---
# ${folder}

${indexDescriptions[folder] || ''}
`)
  }

  // _active-context.md
  createFile(join(vaultPath, '_active-context.md'), `---
type: recurso
created: ${new Date().toISOString().slice(0, 10)}
---
# Contexto Ativo

## Foco atual
-

## Decisoes recentes
-

## Issues abertos
-

## Proximos passos
-
`)

  // VAULT-INDEX.md
  createFile(join(vaultPath, 'VAULT-INDEX.md'), `---
type: recurso
created: ${new Date().toISOString().slice(0, 10)}
---
# Mapa do Vault

- [[Daily/_index|Daily]] — notas diarias
- [[Projetos/_index|Projetos]] — documentacao de projetos
- [[Recursos/_index|Recursos]] — referencias tecnicas
- [[Goals/_index|Goals]] — objetivos e metas
- [[Inbox/_index|Inbox]] — captura rapida
- [[Ideias/_index|Ideias]] — ideias e insights
- [[Pessoas/_index|Pessoas]] — contatos e parceiros
- [[Templates/_index|Templates]] — templates
- [[_memory/_index|_memory]] — resumos de sessoes
- [[_active-context]] — contexto ativo da sessao
`)

  // Daily note template
  createFile(join(vaultPath, 'Templates', 'daily-note.md'), `---
type: daily
created: {{date}}
tags:
  - daily
---
# {{date}}

## Foco do dia
- [[Projetos/...]]

## Feito
-

## Decisoes
-

## Ideias / Notas soltas
-

## Amanha
-
`)

  // ANDRECLAW.md
  createFile(join(vaultPath, 'ANDRECLAW.md'), `---
type: recurso
status: ativo
created: ${new Date().toISOString().slice(0, 10)}
---
# ANDRECLAW.md — Contexto do Vault

## Quem sou eu
${userName}${userStack ? ` — ${userStack}` : ''}. Baseado no Brasil, tudo em PT-BR.

## Como navegar este vault

### Ao iniciar sessao, leia nesta ordem:
1. Este arquivo (ANDRECLAW.md) — regras e contexto permanente
2. [[_active-context]] — memoria de trabalho (foco atual, decisoes recentes, issues)
3. Daily note mais recente em \`/Daily/\`
4. Ultimo resumo em \`/_memory/\` (se existir)

### Estrutura de pastas
- \`/Projetos/\` — documentacao, decisoes e status de cada projeto
- \`/Daily/\` — notas diarias (formato YYYY-MM-DD)
- \`/Recursos/\` — aprendizados, tutoriais, referencias tecnicas
- \`/Goals/\` — cascata de objetivos
- \`/Inbox/\` — captura rapida, processar e mover para pasta correta
- \`/Ideias/\` — ideias brutas, insights
- \`/Pessoas/\` — contatos, parceiros
- \`/Templates/\` — templates para daily notes, projetos, reunioes
- \`/_memory/\` — resumos de sessoes anteriores (gerado por /handover)
- \`/_active-context.md\` — memoria de trabalho

## Regras fundamentais

### Agente le, humano escreve
- NAO escreva conteudo no vault a menos que eu peca explicitamente
- Suas saidas vao pra \`/_memory/\` ou onde eu indicar
- Quando eu pedir sintese: NAO inventar conteudo que nao existe nas notas

### Integridade do vault
- NUNCA deletar ou sobrescrever notas existentes sem confirmacao
- NUNCA modificar frontmatter de notas que nao foram solicitadas
- Quando criar nota, usar template correspondente de \`/Templates/\`

## Convencoes de formatacao

### Texto
- Idioma: PT-BR sempre
- Nomes de arquivo: descritivos, sem acentos, separados por hifen
- Datas: formato ISO (YYYY-MM-DD)

### Links e referencias
- SEMPRE usar \`[[wikilinks]]\` para referenciar outras notas, NUNCA markdown links
- Usar \`[[pasta/arquivo|Nome visivel]]\` quando o path for longo

### Frontmatter YAML (para notas novas)
\`\`\`yaml
---
type: daily | projeto | recurso | ideia | pessoa | goal | review
status: ativo | pausado | concluido | arquivado
created: YYYY-MM-DD
tags:
  - tag1
---
\`\`\`

### Callouts Obsidian
- \`> [!note]\` para notas informativas
- \`> [!warning]\` para avisos
- \`> [!tip]\` para dicas
- \`> [!danger]\` para coisas criticas

## Commands disponiveis
- \`/today\` — planejamento do dia
- \`/close\` — reflexao de fim de dia
- \`/handover\` — salvar resumo e encerrar sessao
- \`/resume\` — retomar da ultima sessao
- \`/my-world\` — carregar contexto completo
- \`/extract\` — extrair ideias de daily notes
- \`/monthly\` — revisao mensal
`)

  // .andreclaw/rules/
  const rulesDir = join(vaultPath, '.andreclaw', 'rules')
  mkdirSync(rulesDir, { recursive: true })

  createFile(join(rulesDir, 'markdown.md'), `# Regras de Markdown

- SEMPRE usar \`[[wikilinks]]\` para referenciar outras notas, NUNCA markdown links \`[text](url)\`
- SEMPRE verificar backlinks bidirecionais: se A linka B, B deveria linkar A
- SEMPRE usar callouts Obsidian: \`> [!note]\`, \`> [!warning]\`, \`> [!tip]\`, \`> [!danger]\`
- SEMPRE formatar codigo em code blocks com linguagem especificada
- NUNCA usar HTML inline — usar sintaxe Obsidian nativa
- Titulos: apenas 1 \`#\` por arquivo, usar \`##\` e \`###\` para secoes
`)

  createFile(join(rulesDir, 'daily.md'), `# Regras para Daily Notes

- SEMPRE usar o template \`Templates/daily-note.md\`
- SEMPRE incluir frontmatter com \`type: daily\`, \`created\`, \`tags: [daily]\`
- SEMPRE preencher "Foco do dia" com link \`[[Projetos/...]]\` para o projeto principal
- Formato do nome: \`YYYY-MM-DD.md\`
- Ao final do dia, garantir que "Amanha" tem pelo menos 1 item
- Referenciar decisoes com [[wikilinks]] para o projeto relevante
`)

  createFile(join(rulesDir, 'inbox.md'), `# Regras para Inbox

- NUNCA deletar nota da Inbox sem mover para a pasta correta primeiro
- Ao mover, SEMPRE adicionar frontmatter YAML com \`type\`, \`created\`, \`tags\`
- Classificacao: ideia → \`/Ideias/\`, projeto → \`/Projetos/\`, recurso → \`/Recursos/\`, pessoa → \`/Pessoas/\`
- Se nao souber classificar, pergunte ao usuario
- Manter conteudo original intacto, so adicionar metadata e [[wikilinks]]
- Renomear arquivo seguindo convencao: sem acentos, separado por hifen
`)

  createFile(join(rulesDir, 'projetos.md'), `# Regras para Projetos

- SEMPRE incluir frontmatter com \`type: projeto\`, \`status\`, \`created\`, \`tags\`
- Status validos: \`ativo\`, \`pausado\`, \`concluido\`, \`arquivado\`
- Cada projeto DEVE ter um \`_index.md\` com visao geral
- Decisoes arquiteturais devem linkar para a nota de origem (daily, reuniao, etc)
- Ao registrar mudanca de status, atualizar tambem o \`_active-context.md\`
`)

  // .andreclaw/commands/
  const commandsDir = join(vaultPath, '.andreclaw', 'commands')
  mkdirSync(commandsDir, { recursive: true })

  createFile(join(commandsDir, 'today.md'), `# /today — Planejamento do dia

Leia a daily note de hoje em \`/Daily/\`. Se nao existir, crie usando o template.
Leia tambem o ultimo resumo em \`/_memory/\` e a daily note de ontem.

Apresente:
1. O que ficou pendente de ontem
2. Status atual dos projetos ativos (baseado nas notas recentes)
3. Sugestao de foco pra hoje

Pergunte: "No que voce quer focar hoje?"
Apos resposta, atualize a secao "Foco do dia" na daily note.
Responda em PT-BR.
`)

  createFile(join(commandsDir, 'close.md'), `# /close — Reflexao de fim de dia

Leia a daily note de hoje em \`/Daily/\`.
Analise o que foi registrado e faca uma reflexao pratica:

1. O que foi concluido vs. o que era o foco planejado
2. Alguma decisao importante tomada que vale registrar em \`/Projetos/\`?
3. Alguma ideia surgiu que deveria ir pra \`/Ideias/\`?
4. O que levar pra amanha

Sugira atualizacoes concretas pra daily note (secoes "Decisoes" e "Amanha").
NAO escreva no vault sem confirmacao.
Responda em PT-BR.
`)

  createFile(join(commandsDir, 'handover.md'), `# /handover — Encerrar sessao

Faca 3 coisas:

## 1. Salvar resumo da sessao
Crie \`_memory/sessao-YYYY-MM-DD-HHmm.md\` com:
\`\`\`
---
type: sessao
created: YYYY-MM-DD
---
# Sessao YYYY-MM-DD HH:mm

## Feito
- ...

## Decisoes tomadas
- ...

## Pendente
- ...

## Contexto pra proxima sessao
- ...
\`\`\`

## 2. Atualizar _active-context.md
Atualize as secoes "Foco atual", "Decisoes recentes", "Issues abertos" e "Proximos passos".

## 3. Atualizar daily note
Adicione o que foi feito na daily note de hoje.

Responda em PT-BR. Peca confirmacao antes de escrever.
`)

  createFile(join(commandsDir, 'resume.md'), `# /resume — Retomar sessao anterior

Leia nesta ordem:
1. \`_active-context.md\` — estado atual
2. O resumo de sessao mais recente em \`/_memory/\`
3. A daily note mais recente em \`/Daily/\`

Apresente:
1. Onde voce parou
2. O que ficou pendente
3. Sugestao de por onde comecar agora

Pergunte: "Quer continuar de onde parou ou iniciar algo novo?"
Responda em PT-BR.
`)

  createFile(join(commandsDir, 'my-world.md'), `# /my-world — Carregar contexto completo

Leia os seguintes arquivos:
1. \`ANDRECLAW.md\` (contexto geral)
2. Todos os \`_index.md\` em \`/Projetos/\`
3. Daily note mais recente em \`/Daily/\`
4. Ultimo resumo em \`/_memory/\`
5. \`/Ideias/_index.md\`

Apresente um panorama de 1 paragrafo: onde estou, o que esta em andamento, o que esta parado.
Depois pergunte: "O que voce precisa hoje?"
Responda em PT-BR.
`)

  createFile(join(commandsDir, 'extract.md'), `# /extract — Extrair ideias de daily notes

Leia a daily note de hoje (ou a especificada pelo usuario).
Identifique ideias, insights ou aprendizados mencionados em "Ideias / Notas soltas".

Para cada ideia encontrada:
1. Crie um arquivo standalone em \`/Ideias/\` com titulo descritivo
2. Inclua backlink pra daily note de origem: \`Origem: [[Daily/YYYY-MM-DD]]\`
3. Adicione contexto e tags relevantes

Se a ideia ja existir em \`/Ideias/\`, atualize-a com o novo contexto em vez de duplicar.
Responda em PT-BR.
`)

  createFile(join(commandsDir, 'monthly.md'), `# /monthly — Revisao mensal

Leia TODAS as weekly reviews do ultimo mes.
Leia tambem o \`_active-context.md\` e os resumos em \`/_memory/\`.

## Analise

### Realizacoes do mes
- O que foi concluido (agrupado por projeto, use [[wikilinks]])

### Tendencias
- Evolucao do foco ao longo das semanas
- Projetos que ganharam/perderam momentum

### Alinhamento com objetivos
- Se existir \`/Goals/\`, compare atividade vs metas

### Proximo mes
- Prioridades sugeridas

## Output
Salve em \`/Daily/monthly-review-YYYY-MM.md\`
Responda em PT-BR.
`)

  // .mcp.json
  createFile(join(vaultPath, '.mcp.json'), `{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
`)

  // Configure Obsidian internal settings
  configureObsidianSettings(vaultPath)

  // Install kepano's official Obsidian skills
  installObsidianSkills(vaultPath)
}

// ─── Kepano's Obsidian Skills ────────────────────────────────────────

function installObsidianSkills(vaultPath: string): void {
  const skillsDir = join(vaultPath, '.andreclaw', 'skills')
  if (!existsSync(skillsDir)) mkdirSync(skillsDir, { recursive: true })

  // Check if already installed
  if (existsSync(join(skillsDir, 'obsidian-cli', 'skill.md'))) return

  try {
    const tmpDir = join(homedir(), '.andreclaw', '.tmp-obsidian-skills')

    // Clone kepano's repo
    execSync(`git clone --depth 1 https://github.com/kepano/obsidian-skills.git "${tmpDir}" 2>/dev/null`, {
      stdio: 'pipe',
      timeout: 30000,
    })

    // Copy skills
    const skillNames = ['obsidian-markdown', 'obsidian-bases', 'json-canvas', 'obsidian-cli', 'defuddle']
    for (const skill of skillNames) {
      const src = join(tmpDir, 'skills', skill)
      const dest = join(skillsDir, skill)
      if (existsSync(src) && !existsSync(dest)) {
        execSync(`cp -r "${src}" "${dest}"`, { stdio: 'pipe' })
      }
    }

    // Cleanup
    try { execSync(`rm -rf "${tmpDir}"`, { stdio: 'pipe' }) } catch {}
  } catch {
    // Git not available or network error — skip silently
  }
}

// ─── Main ────────────────────────────────────────────────────────────

export function shouldRunObsidianSetup(): boolean {
  // Already has setup in current dir
  if (hasAndreclawSetup(process.cwd())) return false
  // Check if first run flag exists
  const flagPath = join(
    process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.andreclaw'),
    '.obsidian-setup-done',
  )
  if (existsSync(flagPath)) return false
  return true
}

export async function runObsidianSetup(): Promise<void> {
  const rl = createReadline()

  try {
    console.log('')
    console.log(`${BOLD}${CYAN}  ========================================${RESET}`)
    console.log(`${BOLD}${CYAN}    Second Brain com Obsidian${RESET}`)
    console.log(`${BOLD}${CYAN}  ========================================${RESET}`)
    console.log('')
    console.log(`  ${WHITE}O AndreClaw funciona melhor com o Obsidian como Second Brain.${RESET}`)
    console.log(`  ${WHITE}Isso otimiza tokens e da memoria persistente entre sessoes.${RESET}`)
    console.log('')

    const hasObsidian = isObsidianInstalled()

    if (!hasObsidian) {
      console.log(`  ${YELLOW}Obsidian nao foi detectado no seu sistema.${RESET}`)
      console.log('')
      const installChoice = await ask(rl, `  ${WHITE}Deseja instalar o Obsidian agora? ${DIM}(s/n/pular)${RESET} `)

      if (installChoice.toLowerCase() === 's' || installChoice.toLowerCase() === 'sim') {
        const installed = installObsidian()
        if (installed) {
          console.log('')
          console.log(`  ${WHITE}Agora abra o Obsidian e crie um vault.${RESET}`)
          console.log(`  ${WHITE}Depois rode ${BOLD}andreclaw${RESET}${WHITE} dentro da pasta do vault.${RESET}`)
          console.log('')
          markSetupDone()
          rl.close()
          return
        }
      } else if (installChoice.toLowerCase() === 'n' || installChoice.toLowerCase() === 'nao' || installChoice.toLowerCase() === 'pular') {
        console.log('')
        console.log(`  ${DIM}Sem problemas! O AndreClaw funciona normalmente sem Obsidian.${RESET}`)
        console.log(`  ${DIM}Quando quiser configurar, rode andreclaw dentro de um vault Obsidian.${RESET}`)
        console.log('')
        markSetupDone()
        rl.close()
        return
      }
    }

    // Obsidian is installed — check if we're in a vault
    const cwd = process.cwd()
    let vaultPath = cwd

    if (!isInsideObsidianVault(cwd)) {
      console.log(`  ${WHITE}Voce nao esta dentro de um vault Obsidian.${RESET}`)
      console.log('')
      const pathInput = await ask(rl, `  ${WHITE}Caminho do seu vault ${DIM}(ou Enter pra pular)${RESET}: `)

      if (!pathInput) {
        console.log('')
        console.log(`  ${DIM}Pulado. Rode andreclaw dentro do vault quando quiser configurar.${RESET}`)
        console.log('')
        markSetupDone()
        rl.close()
        return
      }

      const expandedPath = pathInput.replace(/^~/, homedir())
      if (!existsSync(expandedPath)) {
        console.log(`  ${YELLOW}Pasta nao encontrada: ${expandedPath}${RESET}`)
        markSetupDone()
        rl.close()
        return
      }

      // Verificar se e um vault Obsidian de verdade
      if (!isInsideObsidianVault(expandedPath)) {
        console.log('')
        console.log(`  ${YELLOW}Essa pasta nao e um vault do Obsidian${RESET} ${DIM}(nao tem .obsidian/)${RESET}`)
        console.log('')
        console.log(`  ${WHITE}Abra o Obsidian primeiro e crie um vault nessa pasta,${RESET}`)
        console.log(`  ${WHITE}ou informe o caminho correto de um vault que ja existe.${RESET}`)
        console.log('')
        console.log(`  ${DIM}Dica: no Obsidian, va em "Open folder as vault" e selecione a pasta.${RESET}`)
        console.log(`  ${DIM}Depois rode andreclaw de novo.${RESET}`)
        console.log('')
        markSetupDone()
        rl.close()
        return
      }

      vaultPath = expandedPath
    }

    // Already has setup
    if (hasAndreclawSetup(vaultPath)) {
      console.log(`  ${GREEN}Vault ja configurado!${RESET} ${DIM}(ANDRECLAW.md encontrado)${RESET}`)
      console.log('')
      saveVaultPath(vaultPath)
      markSetupDone()
      rl.close()
      return
    }

    // Get user info
    console.log('')
    const userName = await ask(rl, `  ${WHITE}Seu nome: ${RESET}`)
    const userStack = await ask(rl, `  ${WHITE}Sua stack/area ${DIM}(ex: TypeScript, React, Node.js)${RESET}: `)

    console.log('')
    console.log(`  ${CYAN}Criando estrutura do vault...${RESET}`)

    createVaultStructure(vaultPath, userName || 'Usuario', userStack || '')

    // Salva o caminho do vault pra auto-cd nas proximas execucoes
    saveVaultPath(vaultPath)

    console.log('')
    console.log(`${BOLD}${GREEN}  Vault configurado com sucesso!${RESET}`)
    console.log('')
    console.log(`  ${WHITE}Criados:${RESET}`)
    console.log(`    ${DIM}ANDRECLAW.md${RESET} — contexto permanente`)
    console.log(`    ${DIM}.andreclaw/rules/${RESET} — 4 regras automaticas`)
    console.log(`    ${DIM}.andreclaw/commands/${RESET} — 7 comandos (/today, /handover, etc)`)
    console.log(`    ${DIM}9 pastas${RESET} — Daily, Projetos, Recursos, Goals, etc`)
    console.log(`    ${DIM}Templates/daily-note.md${RESET}`)
    console.log(`    ${DIM}_active-context.md${RESET}`)
    console.log('')
    console.log(`  ${WHITE}Comandos disponiveis:${RESET}`)
    console.log(`    ${BOLD}/today${RESET}     — planejamento do dia`)
    console.log(`    ${BOLD}/handover${RESET}  — encerrar sessao com resumo`)
    console.log(`    ${BOLD}/resume${RESET}    — retomar de onde parou`)
    console.log(`    ${BOLD}/my-world${RESET}  — visao geral completa`)
    console.log('')
    console.log(`  ${WHITE}.obsidian/ configurado:${RESET}`)
    console.log(`    ${DIM}Wikilinks, Daily Notes, Templates, Spellcheck PT-BR${RESET}`)
    console.log(`    ${DIM}Skills do kepano (obsidian-cli, markdown, bases, canvas, defuddle)${RESET}`)
    console.log('')
    console.log(`  ${YELLOW}IMPORTANTE — Passo manual:${RESET}`)
    console.log(`  ${WHITE}Abra o Obsidian > Configuracoes > Avancado > Interface de linha de comando > Ativar${RESET}`)
    console.log(`  ${DIM}Isso ativa o comando "obsidian" no terminal pra buscas rapidas.${RESET}`)
    console.log(`  ${DIM}Nota: requer licenca Catalyst do Obsidian. Sem ela, o AndreClaw${RESET}`)
    console.log(`  ${DIM}funciona normalmente mas sem o CLI do Obsidian.${RESET}`)
    console.log('')

    markSetupDone()
    rl.close()
  } catch {
    rl.close()
  }
}

function saveVaultPath(vaultPath: string): void {
  const configDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.andreclaw')
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true })
  writeFileSync(join(configDir, '.vault-path'), vaultPath, 'utf8')
}

function markSetupDone(): void {
  const configDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.andreclaw')
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true })
  writeFileSync(join(configDir, '.obsidian-setup-done'), new Date().toISOString(), 'utf8')
}
