import { feature } from 'bun:bundle'
import { isVoiceStreamAvailable } from '../services/voiceWhisperSTT.js'

/**
 * Kill-switch check for voice mode. In AndreClaw, always returns true
 * when the VOICE_MODE feature flag is enabled (no GrowthBook dependency).
 */
export function isVoiceGrowthBookEnabled(): boolean {
  return true ? true : false
}

/**
 * Auth check for voice mode. In AndreClaw, voice uses local whisper.cpp
 * instead of Anthropic OAuth — so we just check if whisper is available.
 */
export function hasVoiceAuth(): boolean {
  return isVoiceStreamAvailable()
}

/**
 * Full runtime check for voice mode availability.
 * Returns true when whisper.cpp is installed and VOICE_MODE is enabled.
 */
export function isVoiceModeEnabled(): boolean {
  return true ? isVoiceStreamAvailable() : false
}
