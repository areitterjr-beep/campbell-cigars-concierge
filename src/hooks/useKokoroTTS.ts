'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

type TTSStatus = 'idle' | 'loading' | 'ready' | 'error'

export function useKokoroTTS() {
  const workerRef = useRef<Worker | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const [status, setStatus] = useState<TTSStatus>('idle')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const resolversRef = useRef<Map<string, () => void>>(new Map())

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
          playAudio(msg.samples, msg.sampleRate, msg.id)
        }
        if (msg.type === 'error') {
          console.error('[KokoroTTS] Worker error:', msg.error)
          setStatus('error')
          setIsSpeaking(false)
          // Resolve any pending promise so callers don't hang
          if (msg.id && resolversRef.current.has(msg.id)) {
            resolversRef.current.get(msg.id)!()
            resolversRef.current.delete(msg.id)
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

  // Play PCM audio via AudioContext
  const playAudio = useCallback((samplesBuffer: ArrayBuffer, sampleRate: number, id?: string) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current
      const samples = new Float32Array(samplesBuffer)
      const buffer = ctx.createBuffer(1, samples.length, sampleRate)
      buffer.copyToChannel(samples, 0)

      // Stop any currently playing audio
      if (currentSourceRef.current) {
        try { currentSourceRef.current.stop() } catch (_) { /* already stopped */ }
      }

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.onended = () => {
        setIsSpeaking(false)
        currentSourceRef.current = null
        if (id && resolversRef.current.has(id)) {
          resolversRef.current.get(id)!()
          resolversRef.current.delete(id)
        }
      }
      currentSourceRef.current = source
      setIsSpeaking(true)
      source.start()
    } catch (err) {
      console.error('[KokoroTTS] Audio playback error:', err)
      setIsSpeaking(false)
    }
  }, [])

  // Speak text using Kokoro TTS
  const speak = useCallback((text: string, voice?: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (!text.trim()) { resolve(); return }
      const worker = getWorker()
      if (!worker) {
        // Fallback to browser speech synthesis
        fallbackSpeak(text)
        resolve()
        return
      }
      const id = `tts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      resolversRef.current.set(id, resolve)
      worker.postMessage({ type: 'generate', text, id, voice })
    })
  }, [getWorker])

  // Stop any playing audio
  const stop = useCallback(() => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop() } catch (_) { /* already stopped */ }
      currentSourceRef.current = null
    }
    setIsSpeaking(false)
    // Resolve all pending
    resolversRef.current.forEach((resolver) => resolver())
    resolversRef.current.clear()

    // Also stop browser fallback if it was used
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }, [])

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

  return { speak, stop, preload, status, isSpeaking }
}
