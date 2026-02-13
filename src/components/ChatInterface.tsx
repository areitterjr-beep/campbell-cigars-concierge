'use client'

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { Send, Loader2, Sparkles, Camera, X, Mic, MicOff, Volume2, VolumeX, Download } from 'lucide-react'
import CigarInfoCard, { CigarData } from './CigarInfoCard'
import { useKokoroTTS } from '@/hooks/useKokoroTTS'

// Web Speech API - check support at runtime
const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  image?: string
  cigars?: CigarData[]
  timestamp: Date
}

interface ChatInterfaceProps {
  isExpanded?: boolean
  onEngaged?: () => void
  pendingQuery?: string | null
  onPendingQueryConsumed?: () => void
}

const SUGGESTED_QUESTIONS = [
  "What are cigars all about?",
  "What does strength mean in cigars?",
  "Suggest a medium-bodied cigar",
  "What's good for a celebration?",
  "Mold vs plume (bloom)—what's the difference?",
  "Ideal storage temp and humidity?",
]

export default function ChatInterface({ isExpanded = false, onEngaged, pendingQuery, onPendingQueryConsumed }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Welcome! I'm your personal cigar expert. Ask me for recommendations, use the camera to scan a cigar band in real time, or get pairing suggestions. How can I help?`,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [attachedImage, setAttachedImage] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [isScanning, setIsScanning] = useState(false) // real-time scan in progress
  const [voiceMode, setVoiceMode] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<any>(null)
  const isAnalyzingRef = useRef(false)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const checkReadyRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messagesRef = useRef(messages)
  const speakResponseRef = useRef<((text: string) => void) | null>(null)
  const handleScanResponseRef = useRef<((imageData: string, data: { message?: string; cigars?: CigarData[] }) => void) | null>(null)

  // Kokoro TTS — natural-sounding voice with browser fallback
  const { speak: kokoroSpeak, stop: kokoroStop, preload: kokoroPreload, initAudio: kokoroInitAudio, status: ttsStatus } = useKokoroTTS()

  const lastMessageRef = useRef<HTMLDivElement>(null)

  const scrollToLatestMessage = () => {
    // Scroll so the TOP of the newest message is visible at the top of the viewport
    lastMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Auto-resize textarea whenever input changes (covers voice, programmatic setInput, etc.)
  // useLayoutEffect runs before browser paint → no visible collapse/flash
  useLayoutEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    if (!input) {
      // Input cleared — reset to natural single-row height
      ta.style.height = 'auto'
      return
    }
    // Capture current rendered height before we measure
    const prevHeight = ta.getBoundingClientRect().height
    // Temporarily collapse to get true content scrollHeight
    ta.style.height = '0'
    const contentHeight = ta.scrollHeight
    if (isListening) {
      // During voice capture: only grow, never shrink — prevents bounce from interim results
      ta.style.height = Math.max(contentHeight, prevHeight) + 'px'
    } else {
      // Normal typing: grow and shrink freely
      ta.style.height = contentHeight + 'px'
    }
  }, [input, isListening])

  messagesRef.current = messages

  useEffect(() => {
    scrollToLatestMessage()
  }, [messages])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const startCamera = async () => {
    if (onEngaged) onEngaged()
    setShowCamera(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (err) {
      console.error('Camera error:', err)
      setShowCamera(false)
      alert('Unable to access camera. Please check permissions or upload an image instead.')
    }
  }

  const stopCamera = () => {
    if (checkReadyRef.current) {
      clearInterval(checkReadyRef.current)
      checkReadyRef.current = null
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setShowCamera(false)
    setIsScanning(false)
  }

  const captureFrameAsBase64 = (): string | null => {
    if (!videoRef.current || videoRef.current.videoWidth === 0) return null
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(videoRef.current, 0, 0)
    if (isFrameMostlyBlack(ctx, canvas.width, canvas.height)) return null
    return canvas.toDataURL('image/jpeg', 0.8)
  }

  const isFrameMostlyBlack = (ctx: CanvasRenderingContext2D, w: number, h: number): boolean => {
    try {
      const sampleSize = 9
      const stepX = Math.floor(w / (sampleSize + 1))
      const stepY = Math.floor(h / (sampleSize + 1))
      let totalLuminance = 0
      let count = 0
      for (let i = 1; i <= sampleSize; i++) {
        for (let j = 1; j <= sampleSize; j++) {
          const px = ctx.getImageData(stepX * i, stepY * j, 1, 1).data
          totalLuminance += 0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2]
          count++
        }
      }
      return count > 0 && totalLuminance / count < 15
    } catch {
      return false
    }
  }

  const handleScanResponse = useCallback((imageData: string, data: { message?: string; cigars?: CigarData[] }) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: 'What can you tell me about this cigar?',
      image: imageData,
      timestamp: new Date(),
    }
    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: data.message || "I'm not sure what that is. Can you describe what you see on the band?",
      cigars: data.cigars,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg, assistantMsg])
    if (data.message && speakResponseRef.current) {
      speakResponseRef.current(data.message)
    }
    stopCamera()
  }, [])
  handleScanResponseRef.current = handleScanResponse

  const manualSnap = useCallback(async () => {
    if (isAnalyzingRef.current || !videoRef.current) return
    const imageData = captureFrameAsBase64()
    if (!imageData) return

    isAnalyzingRef.current = true
    setIsScanning(true)
    try {
      const shownCigars = messagesRef.current
        .filter(m => m.cigars && m.cigars.length > 0)
        .flatMap(m => m.cigars!.map(c => c.name))
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'What can you tell me about this cigar?' }],
          image: imageData,
          shownCigars,
        }),
      })
      const data = await response.json()
      handleScanResponse(imageData, data)
    } catch (err) {
      console.error('Snap error:', err)
      handleScanResponse(imageData!, { message: "I had trouble analyzing that. Please try again or describe what you see on the band." })
    } finally {
      isAnalyzingRef.current = false
      setIsScanning(false)
    }
  }, [handleScanResponse])

  const removeAttachedImage = () => {
    setAttachedImage(null)
  }

  // Real-time scan: capture frames periodically until cigar is recognized
  useEffect(() => {
    if (!showCamera || !videoRef.current) return

    const attemptRecognition = async () => {
      if (isAnalyzingRef.current) return
      const imageData = captureFrameAsBase64()
      if (!imageData) return

      isAnalyzingRef.current = true
      setIsScanning(true)

      try {
        const shownCigars = messagesRef.current
          .filter(m => m.cigars && m.cigars.length > 0)
          .flatMap(m => m.cigars!.map(c => c.name))

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'What can you tell me about this cigar?' }],
            image: imageData,
            shownCigars,
          }),
        })

        const data = await response.json()

        const handler = handleScanResponseRef.current
        if (handler && (data.cigars?.length || data.message)) {
          handler(imageData, { message: data.message, cigars: data.cigars || [] })
        }
      } catch (err) {
        console.error('Scan error:', err)
      } finally {
        isAnalyzingRef.current = false
        setIsScanning(false)
      }
    }

    const startInterval = () => {
      const vw = videoRef.current?.videoWidth ?? 0
      if (vw > 0) {
        attemptRecognition()
        scanIntervalRef.current = setInterval(attemptRecognition, 2500)
      } else {
        checkReadyRef.current = setInterval(() => {
          const ready = (videoRef.current?.videoWidth ?? 0) > 0
          if (ready && checkReadyRef.current) {
            clearInterval(checkReadyRef.current)
            checkReadyRef.current = null
            attemptRecognition()
            scanIntervalRef.current = setInterval(attemptRecognition, 2500)
          }
        }, 300)
      }
    }

    const timer = setTimeout(startInterval, 1500)

    return () => {
      clearTimeout(timer)
      if (checkReadyRef.current) {
        clearInterval(checkReadyRef.current)
        checkReadyRef.current = null
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
        scanIntervalRef.current = null
      }
    }
  }, [showCamera])

  // Text-to-speech: read response aloud using Kokoro (natural) with browser fallback
  const speakResponse = useCallback((text: string) => {
    if (!voiceMode || !text.trim()) return
    const clean = text.replace(/\*\*(.*?)\*\*/g, '$1') // strip markdown bold
    kokoroSpeak(clean)
  }, [voiceMode, kokoroSpeak])
  speakResponseRef.current = speakResponse

  const stopSpeaking = useCallback(() => {
    kokoroStop()
  }, [kokoroStop])

  // Preload TTS model when user first enables voice mode
  useEffect(() => {
    if (voiceMode && ttsStatus === 'idle') {
      kokoroPreload()
    }
  }, [voiceMode, ttsStatus, kokoroPreload])

  // Speech-to-text: listen and transcribe
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }
    if (isListening) return
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    // Keep finalized segments separate from the current interim segment
    const finalizedParts: string[] = []
    const transcriptRef = { current: '' }

    recognition.onresult = (e: any) => {
      // Rebuild: collect all final segments, plus the latest interim
      finalizedParts.length = 0
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalizedParts.push(e.results[i][0].transcript)
        } else {
          interim = e.results[i][0].transcript
        }
      }
      const full = (finalizedParts.join(' ') + ' ' + interim).trim()
      if (full) {
        transcriptRef.current = full
        setInput(full)  // useEffect auto-resizes textarea on input change
      }

      // Reset the silence timer — wait 2.5s of silence before auto-sending
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = setTimeout(() => {
        if (finalizedParts.length > 0 && transcriptRef.current.trim()) {
          recognition.stop()
        }
      }, 2500)
    }

    recognition.onend = () => {
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
      setIsListening(false)
      recognitionRef.current = null
      const text = transcriptRef.current.trim()
      if (text) {
        setInput('')
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        handleSendRef.current(text)
      }
    }

    recognition.onerror = () => {
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
      setIsListening(false)
    }
    recognition.start()
    setIsListening(true)
  }, [isListening])

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  const handleSendRef = useRef<(msg?: string) => void>(() => {})

  useEffect(() => {
    if (!voiceMode) stopSpeaking()
  }, [voiceMode, stopSpeaking])

  useEffect(() => {
    return () => {
      stopListening()
      stopSpeaking()
    }
  }, [stopListening, stopSpeaking])

  const handleSend = async (messageText?: string) => {
    const text = messageText || input
    if ((!text.trim() && !attachedImage) || isLoading) return

    // Notify parent that user has engaged with chat
    if (onEngaged) {
      onEngaged()
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text || (attachedImage ? "What can you tell me about this cigar?" : ''),
      image: attachedImage || undefined,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    const imageToSend = attachedImage
    setAttachedImage(null)
    setIsLoading(true)

    try {
      // Collect all cigars already shown in conversation to avoid repetition
      const shownCigars = messages
        .filter(m => m.cigars && m.cigars.length > 0)
        .flatMap(m => m.cigars!.map(c => c.name))
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          image: imageToSend,
          shownCigars: shownCigars,
        }),
      })

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || "I apologize, but I'm having trouble responding right now.",
        cigars: data.cigars,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
      if (voiceMode && data.message) {
        speakResponse(data.message)
      }
    } catch (error) {
      console.error('Chat error:', error)
      const errorContent = "I'm sorry, I encountered an error. Please try again in a moment."
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
      if (voiceMode) speakResponse(errorContent)
    } finally {
      setIsLoading(false)
    }
  }
  handleSendRef.current = handleSend

  // Handle pending query from external navigation (e.g., Quick Start Guide cigar click)
  const pendingConsumedRef = useRef<string | null>(null)
  useEffect(() => {
    if (pendingQuery && pendingQuery !== pendingConsumedRef.current) {
      pendingConsumedRef.current = pendingQuery
      handleSendRef.current(pendingQuery)
      onPendingQueryConsumed?.()
    }
  }, [pendingQuery, onPendingQueryConsumed])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={`flex flex-col bg-white shadow-lg overflow-hidden relative transition-all duration-300 ${
      isExpanded 
        ? 'h-[calc(100vh-100px)] rounded-none' 
        : 'h-[calc(100vh-280px)] rounded-2xl'
    }`}>

      {/* Camera View - Fills content area, keeps container borders */}
      {showCamera ? (
        <div className="flex-1 flex flex-col min-h-0 m-3 rounded-xl overflow-hidden border-2 border-cigar-gold/30 bg-black transition-all duration-300">
          <div className="flex-1 relative min-h-0">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            <button
              onClick={stopCamera}
              className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors backdrop-blur-sm"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
              <p className="text-white text-center text-sm mb-2">
                {isScanning ? 'Scanning...' : 'Point camera at cigar band'}
              </p>
              {isScanning && (
                <div className="flex justify-center mb-2">
                  <Loader2 className="w-6 h-6 animate-spin text-cigar-gold" />
                </div>
              )}
              <div className="flex justify-center gap-4 items-center">
                <button
                  onClick={manualSnap}
                  disabled={isScanning}
                  className="w-16 h-16 bg-white rounded-full flex items-center justify-center border-4 border-cigar-gold
                           hover:scale-105 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Capture photo"
                >
                  <div className="w-12 h-12 bg-cigar-gold rounded-full" />
                </button>
              </div>
              <p className="text-white/60 text-center text-xs mt-2">
                Tap to capture when band is in focus, or wait for auto-scan. Tap X to cancel.
              </p>
            </div>
          </div>
        </div>
      ) : (
      /* Messages Area */
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={message.id}
            ref={index === messages.length - 1 ? lastMessageRef : undefined}
            className={`message-slide-in ${
              message.role === 'user' ? 'flex justify-end' : ''
            }`}
          >
            <div className={`max-w-full ${message.role === 'user' ? 'text-right' : ''}`}>
              {/* User image */}
              {message.image && (
                <div className={`mb-2 ${message.role === 'user' ? 'flex justify-end' : ''}`}>
                  <img 
                    src={message.image} 
                    alt="Attached" 
                    className="max-w-[200px] rounded-lg object-cover border-2 border-cigar-gold"
                  />
                </div>
              )}
              
              {/* Text content */}
              {message.content && (
                <div
                  className={`rounded-2xl px-4 py-3 inline-block text-left ${
                    message.role === 'user'
                      ? 'bg-cigar-gold text-cigar-dark'
                      : 'bg-cigar-cream text-cigar-dark'
                  }`}
                >
                  <div className="prose prose-sm max-w-none">
                    {message.content.split('\n').map((line, i) => (
                      <p key={i} className="mb-1 last:mb-0 text-sm">
                        {line.startsWith('•') ? (
                          <span className="flex gap-2">
                            <span>•</span>
                            <span dangerouslySetInnerHTML={{ __html: formatBold(line.substring(1)) }} />
                          </span>
                        ) : (
                          <span dangerouslySetInnerHTML={{ __html: formatBold(line) }} />
                        )}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Cigar Cards - limited to 2 */}
              {message.cigars && message.cigars.length > 0 && (
                <div className="mt-3">
                  <div className={`grid gap-3 ${
                    message.cigars.slice(0, 2).length === 1 
                      ? 'grid-cols-1 max-w-sm' 
                      : 'grid-cols-1 sm:grid-cols-2'
                  }`}>
                    {message.cigars.slice(0, 2).map((cigar, i) => (
                      <CigarInfoCard key={i} cigar={cigar} fullWidth />
                    ))}
                  </div>
                  {/* See More Button - only show on most recent assistant message */}
                  {message.role === 'assistant' && 
                   message.id === messages.filter(m => m.role === 'assistant').slice(-1)[0]?.id && (
                    <button
                      onClick={() => handleSend("Show me more options")}
                      disabled={isLoading}
                      className="mt-4 px-5 py-2.5 bg-cigar-gold hover:bg-cigar-amber text-cigar-dark 
                               font-semibold rounded-xl transition-colors shadow-md hover:shadow-lg
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      See More Options
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message-slide-in">
            <div className="bg-cigar-cream rounded-2xl px-4 py-3 inline-block">
              <Loader2 className="w-5 h-5 animate-spin text-cigar-gold" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
      )}

      {/* Suggested Questions */}
      {messages.length <= 2 && !attachedImage && !showCamera && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Sparkles className="w-4 h-4" />
            <span>Quick questions:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((question, i) => (
              <button
                key={i}
                onClick={() => handleSend(question)}
                className="text-xs bg-cigar-cream hover:bg-cigar-gold/20 text-cigar-dark 
                         px-3 py-1.5 rounded-full transition-colors border border-cigar-gold/30"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attached Image Preview */}
      {attachedImage && !showCamera && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            <img 
              src={attachedImage} 
              alt="Attached" 
              className="h-20 rounded-lg object-cover border-2 border-cigar-gold"
            />
            <button
              onClick={removeAttachedImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Photo attached</p>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)  // useEffect auto-resizes textarea on input change
            }}
            onKeyPress={handleKeyPress}
            placeholder={attachedImage ? "Ask about this cigar..." : isListening ? "Listening..." : "Ask me anything..."}
            className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-cigar-gold focus:border-transparent
                     placeholder-gray-400 text-cigar-dark overflow-hidden"
            rows={1}
          />
          <button
            onClick={() => {
              if (!voiceMode) {
                // Toggling ON — create/resume AudioContext during this user gesture
                // so the browser allows audio playback later from async contexts
                kokoroInitAudio()
              }
              setVoiceMode(!voiceMode)
            }}
            className={`p-2.5 rounded-xl transition-colors relative ${
              voiceMode ? 'bg-cigar-gold text-cigar-dark' : 'bg-cigar-cream hover:bg-cigar-gold/30 text-cigar-dark'
            }`}
            title={
              ttsStatus === 'loading'
                ? 'Downloading voice model...'
                : voiceMode
                  ? 'Voice mode on - responses will be read aloud'
                  : 'Voice mode off - tap to enable'
            }
          >
            {ttsStatus === 'loading' && voiceMode ? (
              <Download className="w-5 h-5 animate-bounce" />
            ) : voiceMode ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={() => startCamera()}
            className="bg-cigar-cream hover:bg-cigar-gold/30 text-cigar-dark p-2.5 rounded-xl transition-colors"
            title="Scan cigar band in real time"
          >
            <Camera className="w-5 h-5" />
          </button>
          {getSpeechRecognition() ? (
            <button
              onClick={() => {
                if (!isListening) kokoroInitAudio() // warm AudioContext during user gesture
                isListening ? stopListening() : startListening()
              }}
              className={`p-2.5 rounded-xl transition-colors ${
                isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-cigar-cream hover:bg-cigar-gold/30 text-cigar-dark'
              }`}
              title={isListening ? "Stop listening" : "Voice input"}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          ) : null}
          <button
            onClick={() => handleSend()}
            disabled={(!input.trim() && !attachedImage) || isLoading}
            className="bg-cigar-gold hover:bg-cigar-amber disabled:bg-gray-300 
                     text-cigar-dark p-2.5 rounded-xl transition-colors disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function formatBold(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
}
