import { normalizeLanguageForSTT } from '../../hooks/useVoice.js'
import { getShortcutDisplay } from '../../keybindings/shortcutFormat.js'
import { getWhisperStatus } from '../../services/voiceWhisperSTT.js'
import type { LocalCommandCall } from '../../types/command.js'
import { getInitialSettings } from '../../utils/settings/settings.js'

export const call: LocalCommandCall = async () => {
  // Check whisper.cpp availability
  const whisper = getWhisperStatus()
  if (!whisper.available) {
    const hint = whisper.installCommand
      ? `\nInstall whisper.cpp: ${whisper.installCommand}`
      : '\nSee https://github.com/ggml-org/whisper.cpp for installation.'
    return {
      type: 'text' as const,
      value: `Voice mode requires whisper.cpp for local speech-to-text.${hint}`,
    }
  }

  if (!whisper.model) {
    return {
      type: 'text' as const,
      value:
        'Whisper model not found. Download one:\n' +
        '  mkdir -p ~/.cache/whisper && curl -L -o ~/.cache/whisper/ggml-base.bin \\\n' +
        '    https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin\n' +
        'Or set WHISPER_MODEL_PATH env var.',
    }
  }

  // Run pre-flight checks
  const { checkRecordingAvailability } = await import('../../services/voice.js')
  const recording = await checkRecordingAvailability()
  if (!recording.available) {
    return {
      type: 'text' as const,
      value:
        recording.reason ?? 'Voice mode is not available in this environment.',
    }
  }

  const { checkVoiceDependencies, requestMicrophonePermission } = await import(
    '../../services/voice.js'
  )
  const deps = await checkVoiceDependencies()
  if (!deps.available) {
    const hint = deps.installCommand
      ? `\nInstall audio recording tools? Run: ${deps.installCommand}`
      : '\nInstall SoX manually for audio recording.'
    return {
      type: 'text' as const,
      value: `No audio recording tool found.${hint}`,
    }
  }

  if (!(await requestMicrophonePermission())) {
    let guidance: string
    if (process.platform === 'win32') {
      guidance = 'Settings \u2192 Privacy \u2192 Microphone'
    } else if (process.platform === 'linux') {
      guidance = "your system's audio settings"
    } else {
      guidance = 'System Settings \u2192 Privacy & Security \u2192 Microphone'
    }
    return {
      type: 'text' as const,
      value: `Microphone access is denied. To enable it, go to ${guidance}, then run /voice again.`,
    }
  }

  // All checks passed — show status
  const key = getShortcutDisplay('voice:pushToTalk', 'Chat', 'Ctrl+Space')
  const currentSettings = getInitialSettings()
  const stt = normalizeLanguageForSTT(currentSettings.language)
  let langNote = ''
  if (stt.fellBackFrom) {
    langNote = `\nNote: "${stt.fellBackFrom}" is not a supported dictation language; using English.`
  } else {
    langNote = `\nDictation language: ${stt.code} (/config to change).`
  }
  return {
    type: 'text' as const,
    value: `Voice mode active (whisper.cpp local STT).\nHold ${key} to record, release to transcribe.${langNote}\nBinary: ${whisper.binary}\nModel: ${whisper.model}`,
  }
}
