// Local whisper.cpp speech-to-text provider for AndreClaw voice mode.
//
// Drop-in replacement for voiceStreamSTT.ts. Instead of connecting to
// Anthropic's voice_stream WebSocket endpoint, this provider runs
// whisper.cpp locally for transcription. Supports incremental (interim)
// transcription during recording for real-time text preview.
//
// Audio format expected: PCM 16kHz, 16-bit signed LE, mono (same as
// services/voice.ts produces).

import { execFile, spawnSync } from 'child_process'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { logForDebugging } from '../utils/debug.js'
import { logError } from '../utils/log.js'

// ─── Types (same interface as voiceStreamSTT.ts) ────────────────────

export type VoiceStreamCallbacks = {
  onTranscript: (text: string, isFinal: boolean) => void
  onError: (error: string, opts?: { fatal?: boolean }) => void
  onClose: () => void
  onReady: (connection: VoiceStreamConnection) => void
}

export type FinalizeSource =
  | 'post_closestream_endpoint'
  | 'no_data_timeout'
  | 'safety_timeout'
  | 'ws_close'
  | 'ws_already_closed'

export type VoiceStreamConnection = {
  send: (audioChunk: Buffer) => void
  finalize: () => Promise<FinalizeSource>
  close: () => void
  isConnected: () => boolean
}

// ─── Whisper binary detection ───────────────────────────────────────

// Possible binary names for whisper.cpp on different systems.
// Homebrew 1.8+ installs as 'whisper-cli', older versions as 'whisper-cpp'.
const WHISPER_BINARIES = ['whisper-cli', 'whisper-cpp', 'whisper', 'main']

let cachedWhisperBinary: string | null | undefined = undefined

function findWhisperBinary(): string | null {
  if (cachedWhisperBinary !== undefined) return cachedWhisperBinary

  // Check env var override first
  if (process.env.WHISPER_BINARY) {
    cachedWhisperBinary = process.env.WHISPER_BINARY
    return cachedWhisperBinary
  }

  for (const bin of WHISPER_BINARIES) {
    const result = spawnSync(bin, ['--help'], {
      stdio: 'ignore',
      timeout: 3000,
    })
    if (result.error === undefined) {
      cachedWhisperBinary = bin
      logForDebugging(`[voice-whisper] Found whisper binary: ${bin}`)
      return bin
    }
  }

  cachedWhisperBinary = null
  return null
}

// ─── Model detection ────────────────────────────────────────────────

const DEFAULT_MODEL_NAMES = [
  'ggml-base.bin',
  'ggml-base.en.bin',
  'ggml-small.bin',
  'ggml-tiny.bin',
]

const MODEL_SEARCH_PATHS = [
  // Homebrew default on macOS
  '/usr/local/share/whisper-cpp/models',
  '/opt/homebrew/share/whisper-cpp/models',
  // Common user locations
  join(process.env.HOME ?? '', '.cache', 'whisper'),
  join(process.env.HOME ?? '', '.local', 'share', 'whisper'),
  join(process.env.HOME ?? '', 'whisper.cpp', 'models'),
  // XDG data home
  join(process.env.XDG_DATA_HOME ?? join(process.env.HOME ?? '', '.local', 'share'), 'whisper'),
]

function findWhisperModel(): string | null {
  // Check env var override first
  if (process.env.WHISPER_MODEL_PATH) {
    return process.env.WHISPER_MODEL_PATH
  }

  const { existsSync } = require('fs')
  for (const dir of MODEL_SEARCH_PATHS) {
    for (const model of DEFAULT_MODEL_NAMES) {
      const path = join(dir, model)
      if (existsSync(path)) {
        logForDebugging(`[voice-whisper] Found model: ${path}`)
        return path
      }
    }
  }

  return null
}

// ─── Availability ───────────────────────────────────────────────────

export function isVoiceStreamAvailable(): boolean {
  return findWhisperBinary() !== null
}

export function getWhisperStatus(): {
  available: boolean
  binary: string | null
  model: string | null
  installCommand: string | null
} {
  const binary = findWhisperBinary()
  const model = binary ? findWhisperModel() : null

  let installCommand: string | null = null
  if (!binary) {
    if (process.platform === 'darwin') {
      installCommand = 'brew install whisper-cpp'
    } else if (process.platform === 'linux') {
      installCommand = 'See https://github.com/ggml-org/whisper.cpp#build'
    }
  }

  return { available: binary !== null, binary, model, installCommand }
}

// ─── WAV file helpers ───────────────────────────────────────────────

function createWavBuffer(pcmChunks: Buffer[]): Buffer {
  const pcmData = Buffer.concat(pcmChunks)
  const sampleRate = 16000
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcmData.length

  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcmData])
}

// ─── Transcription helper ───────────────────────────────────────────

function transcribeAudio(
  binary: string,
  modelPath: string | null,
  wavPath: string,
  language: string,
): Promise<string> {
  const args: string[] = []
  if (modelPath) args.push('-m', modelPath)
  args.push('-l', language)
  args.push('--no-timestamps')
  args.push('-np')
  args.push('-f', wavPath)
  const { cpus: getCpus } = require('os')
  const threads = Math.max(1, Math.floor(getCpus().length / 2))
  args.push('-t', String(threads))

  return new Promise<string>((resolve, reject) => {
    execFile(
      binary,
      args,
      { timeout: 30_000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          if (stderr) logForDebugging(`[voice-whisper] stderr: ${stderr}`)
          reject(error)
          return
        }
        const text = stdout
          .replace(/\[BLANK_AUDIO\]/g, '')
          .replace(/\[.*?\]/g, '')
          .trim()
        resolve(text)
      },
    )
  })
}

// ─── Constants ──────────────────────────────────────────────────────

// Interim transcription interval: every N bytes of audio (~2s at 16kHz/16-bit/mono = 64KB)
const INTERIM_INTERVAL_BYTES = 64_000
// Minimum audio for first interim (need enough for whisper to work, ~1.5s)
const MIN_INTERIM_BYTES = 48_000

// ─── Connection ─────────────────────────────────────────────────────

export async function connectVoiceStream(
  callbacks: VoiceStreamCallbacks,
  options?: { language?: string; keyterms?: string[] },
): Promise<VoiceStreamConnection | null> {
  const binary = findWhisperBinary()
  if (!binary) {
    logForDebugging('[voice-whisper] No whisper binary found')
    return null
  }

  const modelPath = findWhisperModel()
  const lang = options?.language ?? 'en'

  const audioChunks: Buffer[] = []
  let totalBytes = 0
  let lastInterimBytes = 0
  let closed = false
  let finalized = false
  let interimRunning = false
  let interimTempDir: string | null = null

  // Run an interim transcription on the audio accumulated so far
  async function runInterimTranscription(): Promise<void> {
    if (interimRunning || closed || finalized) return
    if (totalBytes < MIN_INTERIM_BYTES) return

    interimRunning = true
    try {
      // Snapshot current chunks
      const snapshot = [...audioChunks]
      interimTempDir = await mkdtemp(join(tmpdir(), 'andreclaw-voice-interim-'))
      const wavPath = join(interimTempDir, 'interim.wav')
      const wavBuffer = createWavBuffer(snapshot)
      await writeFile(wavPath, wavBuffer)

      logForDebugging(
        `[voice-whisper] Interim transcription: ${String(wavBuffer.length)} bytes`,
      )

      const text = await transcribeAudio(binary, modelPath, wavPath, lang)

      // Only emit if we haven't been finalized/closed during transcription
      if (!finalized && !closed && text) {
        logForDebugging(
          `[voice-whisper] Interim result: "${text.slice(0, 100)}"`,
        )
        callbacks.onTranscript(text, false) // false = interim, not final
      }
    } catch (err) {
      logForDebugging(
        `[voice-whisper] Interim transcription error: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      if (interimTempDir) {
        void rm(interimTempDir, { recursive: true, force: true }).catch(() => {})
        interimTempDir = null
      }
      interimRunning = false
    }
  }

  const connection: VoiceStreamConnection = {
    send(audioChunk: Buffer): void {
      if (closed || finalized) return
      const owned = Buffer.from(audioChunk)
      audioChunks.push(owned)
      totalBytes += owned.length

      // Trigger interim transcription periodically
      if (
        !interimRunning &&
        totalBytes - lastInterimBytes >= INTERIM_INTERVAL_BYTES &&
        totalBytes >= MIN_INTERIM_BYTES
      ) {
        lastInterimBytes = totalBytes
        void runInterimTranscription()
      }
    },

    async finalize(): Promise<FinalizeSource> {
      if (finalized || closed) {
        return 'ws_already_closed'
      }
      finalized = true

      if (audioChunks.length === 0) {
        logForDebugging('[voice-whisper] No audio data to transcribe')
        callbacks.onClose()
        return 'post_closestream_endpoint'
      }

      // Final transcription on the full audio
      let tempDir: string | null = null
      try {
        tempDir = await mkdtemp(join(tmpdir(), 'andreclaw-voice-'))
        const wavPath = join(tempDir, 'recording.wav')
        const wavBuffer = createWavBuffer(audioChunks)

        logForDebugging(
          `[voice-whisper] Final transcription: ${String(wavBuffer.length)} bytes`,
        )
        await writeFile(wavPath, wavBuffer)

        const transcript = await transcribeAudio(binary, modelPath, wavPath, lang)

        logForDebugging(
          `[voice-whisper] Final result (${String(transcript.length)} chars): "${transcript.slice(0, 200)}"`,
        )

        if (transcript) {
          callbacks.onTranscript(transcript, true) // true = final
        }

        callbacks.onClose()
        return 'post_closestream_endpoint'
      } catch (err) {
        logError(err instanceof Error ? err : new Error(String(err)))

        const errMsg = err instanceof Error ? err.message : String(err)
        if (errMsg.includes('model') || errMsg.includes('ggml') || !modelPath) {
          callbacks.onError(
            'Whisper model not found. Download a model:\n' +
              '  curl -L -o ~/.cache/whisper/ggml-base.bin \\\n' +
              '    https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin\n' +
              'Or set WHISPER_MODEL_PATH env var.',
            { fatal: true },
          )
        } else {
          callbacks.onError(`Whisper transcription failed: ${errMsg}`)
        }

        callbacks.onClose()
        return 'safety_timeout'
      } finally {
        if (tempDir) {
          void rm(tempDir, { recursive: true, force: true }).catch(() => {})
        }
        audioChunks.length = 0
      }
    },

    close(): void {
      closed = true
      audioChunks.length = 0
    },

    isConnected(): boolean {
      return !closed && !finalized
    },
  }

  // Call onReady immediately — no WebSocket to wait for
  setTimeout(() => {
    if (!closed) {
      callbacks.onReady(connection)
    }
  }, 0)

  return connection
}
