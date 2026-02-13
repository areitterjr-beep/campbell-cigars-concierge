'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

type TTSStatus = 'idle' | 'loading' | 'ready' | 'error'

// Split text into speakable sentences/chunks
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation, keeping the punctuation
  const raw = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text]
  // Clean up and filter empties
  return raw.map(s => s.trim()).filter(s => s.length > 0)
}

export function useKokoroTTS() {
  const workerRef = useRef<Worker | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const [status, setStatus] = useState<TTSStatus>('idle')
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Queue for sentence-level streaming
  const audioQueueRef = useRef<{ samples: ArrayBuffer; sampleRate: number }[]>([])
  const isPlayingRef = useRef(false)
  const pendingGenerationsRef = useRef(0)
  const stopRequestedRef = useRef(false)
  const speakResolverRef = useRef<(() => void) | null>(null)

  // Single-shot resolvers for individual chunk generation
  const chunkResolversRef = useRef<Map<string, (data: { samples: ArrayBuffer; sampleRate: number }) => void>>(new Map())

  // Lazy-create the worker on first use
  const getWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current
    try {
      const worker = new Worker(new URL('../app/tts-worker.js', import.meta.url), {
        type: 'module',
      })
      worker.addEventListener('message', (e) => {
        const msg = e.data
        if (msg.type === 'status') {
          setStatus(msg.status as TTSStatus)
        }
        if (msg.type === 'audio') {
          // Route to chunk resolver if one exists
          if (msg.id && chunkResolversRef.current.has(msg.id)) {
            chunkResolversRef.current.get(msg.id)!({
              samples: msg.samples,
              sampleRate: msg.sampleRate,
            })
            chunkResolversRef.current.delete(msg.id)
          }
        }
        if (msg.type === 'error') {
          console.error('[KokoroTTS] Worker error:', msg.error)
          // Resolve any pending chunk resolver with empty data
          if (msg.id && chunkResolversRef.current.has(msg.id)) {
            chunkResolversRef.current.get(msg.id)!({ samples: new ArrayBuffer(0), sampleRate: 24000 })
            chunkResolversRef.current.delete(msg.id)
          }
          if (chunkResolversRef.current.size === 0) {
            setStatus('error')
          }
        }
      })
      workerRef.current = worker
      return worker
    } catch (err) {
      console.error('[KokoroTTS] Failed to create worker:', err)
      setStatus('error')
      return null
    }
  }, [])

  // Warm up the AudioContext — MUST be called from a user gesture (click/tap)
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext()
    }
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => { /* best effort */ })
    }
  }, [])

  // Generate audio for a single text chunk via the worker
  const generateChunk = useCallback((text: string, voice?: string): Promise<{ samples: ArrayBuffer; sampleRate: number }> => {
    return new Promise((resolve) => {
      const worker = getWorker()
      if (!worker) {
        resolve({ samples: new ArrayBuffer(0), sampleRate: 24000 })
        return
      }
      const id = `chunk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      chunkResolversRef.current.set(id, resolve)
      worker.postMessage({ type: 'generate', text, id, voice })
    })
  }, [getWorker])

  // Play one audio buffer and return a promise that resolves when it ends
  const playBuffer = useCallback(async (samplesBuffer: ArrayBuffer, sampleRate: number): Promise<void> => {
    if (!samplesBuffer || samplesBuffer.byteLength === 0) return

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext()
    }
    const ctx = audioCtxRef.current
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    const samples = new Float32Array(samplesBuffer)
    const buffer = ctx.createBuffer(1, samples.length, sampleRate)
    buffer.copyToChannel(samples, 0)

    // Stop any currently playing audio
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop() } catch (_) { /* already stopped */ }
    }

    return new Promise<void>((resolve) => {
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.onended = () => {
        currentSourceRef.current = null
        resolve()
      }
      currentSourceRef.current = source
      source.start()
    })
  }, [])

  // Process the audio queue: play chunks sequentially
  const processQueue = useCallback(async () => {
    if (isPlayingRef.current) return // already processing
    isPlayingRef.current = true

    while (audioQueueRef.current.length > 0) {
      if (stopRequestedRef.current) break
      const chunk = audioQueueRef.current.shift()!
      if (chunk.samples.byteLength > 0) {
        try {
          await playBuffer(chunk.samples, chunk.sampleRate)
        } catch (err) {
          console.error('[KokoroTTS] Playback error:', err)
        }
      }
    }

    isPlayingRef.current = false

    // If no more pending generations and queue is empty, we're done speaking
    if (pendingGenerationsRef.current <= 0 && audioQueueRef.current.length === 0) {
      setIsSpeaking(false)
      if (speakResolverRef.current) {
        speakResolverRef.current()
        speakResolverRef.current = null
      }
    }
  }, [playBuffer])

  // Browser speechSynthesis fallback
  const fallbackSpeak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(
      (v) => v.name.includes('Samantha') || v.name.includes('Google') || v.lang.startsWith('en')
    )
    if (preferred) utterance.voice = preferred
    setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [])

  // Speak text using Kokoro TTS with sentence-level streaming
  const speak = useCallback((text: string, voice?: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!text.trim()) { resolve(); return }

      // If Kokoro worker previously errored, go straight to browser fallback
      if (status === 'error') {
        fallbackSpeak(text)
        resolve()
        return
      }

      const worker = getWorker()
      if (!worker) {
        fallbackSpeak(text)
        resolve()
        return
      }

      // Ensure AudioContext is ready
      initAudio()

      // Reset state
      stopRequestedRef.current = false
      audioQueueRef.current = []
      pendingGenerationsRef.current = 0
      speakResolverRef.current = resolve
      setIsSpeaking(true)

      // Split into sentences for streaming
      const sentences = splitIntoSentences(text)
      pendingGenerationsRef.current = sentences.length

      // Generate all sentences, but they'll play in order as they arrive
      sentences.forEach((sentence, i) => {
        // Small stagger to preserve ordering since worker processes sequentially
        setTimeout(() => {
          if (stopRequestedRef.current) {
            pendingGenerationsRef.current--
            return
          }
          generateChunk(sentence, voice).then((audio) => {
            pendingGenerationsRef.current--
            if (stopRequestedRef.current) return
            audioQueueRef.current.push(audio)
            processQueue() // Start playing if not already
          })
        }, i * 50) // tiny stagger to maintain order
      })
    })
  }, [getWorker, status, fallbackSpeak, initAudio, generateChunk, processQueue])

  // Stop any playing audio
  const stop = useCallback(() => {
    stopRequestedRef.current = true
    audioQueueRef.current = []
    pendingGenerationsRef.current = 0

    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop() } catch (_) { /* already stopped */ }
      currentSourceRef.current = null
    }
    isPlayingRef.current = false
    setIsSpeaking(false)

    // Resolve pending speak promise
    if (speakResolverRef.current) {
      speakResolverRef.current()
      speakResolverRef.current = null
    }

    // Clear any pending chunk resolvers
    chunkResolversRef.current.forEach((resolver) => resolver({ samples: new ArrayBuffer(0), sampleRate: 24000 }))
    chunkResolversRef.current.clear()

    // Also stop browser fallback if it was used
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }, [])

  // Preload the model (call early so it's ready when user enables voice)
  const preload = useCallback(() => {
    const worker = getWorker()
    if (worker && status === 'idle') {
      worker.postMessage({ type: 'generate', text: '', id: 'preload' })
    }
  }, [getWorker, status])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close()
        audioCtxRef.current = null
      }
    }
  }, [])

  return { speak, stop, preload, initAudio, status, isSpeaking }
}
