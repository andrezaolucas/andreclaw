import { isVoiceModeEnabled } from '../voice/voiceModeEnabled.js'

/**
 * AndreClaw: voice is always enabled when whisper.cpp is available.
 * No settings toggle needed — local STT has no cost or auth dependency.
 */
export function useVoiceEnabled(): boolean {
  return isVoiceModeEnabled()
}
