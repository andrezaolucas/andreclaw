import type { Command } from '../../commands.js'

const voice = {
  type: 'local',
  name: 'voice',
  description: 'Toggle voice mode (whisper.cpp local STT)',
  isEnabled: () => true,
  isHidden: false,
  supportsNonInteractive: false,
  load: () => import('./voice.js'),
} satisfies Command

export default voice
