'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, Sparkles, Camera, X, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import CigarInfoCard, { CigarData } from './CigarInfoCard'

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
}

const SUGGESTED_QUESTIONS = [
  "What are cigars all about?",
  "What does strength mean in cigars?",
  "Suggest a medium bodied cigar",
  "What's good for a celebration?",
  "Mold vs plume (bloom)—what's the difference?",
  "Ideal storage temp and humidity?",
]

export default function ChatInterface({ isExpanded = false, onEngaged }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Welcome! I'm your personal cigar expert. Ask me for recommendations, snap a photo to identify a cigar, or get pairing suggestions. How can I help?`,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [attachedImage, setAttachedImage] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<any>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const startCamera = async () => {
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setShowCamera(false)
  }

  const capturePhoto = () => {
    if (!videoRef.current) return
    
    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    ctx?.drawImage(videoRef.current, 0, 0)
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8)
    setAttachedImage(imageData)
    stopCamera()
  }

  const removeAttachedImage = () => {
    setAttachedImage(null)
  }

  // Text-to-speech: read response aloud
  const speakResponse = useCallback((text: string) => {
    if (!voiceMode || !text.trim()) return
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v => v.name.includes('Samantha') || v.name.includes('Google') || v.lang.startsWith('en'))
    if (preferred) utterance.voice = preferred
    window.speechSynthesis.speak(utterance)
  }, [voiceMode])

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
  }, [])

  // Speech-to-text: listen and transcribe
  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }
    if (isListening) return
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognitionRef.current = recognition
    const transcriptRef = { current: '' }
    recognition.onresult = (e: any) => {
      const results = Array.from(e.results)
      const transcript = results.map((r: any) => r[0].transcript).join('').trim()
      if (transcript) {
        transcriptRef.current = transcript
        setInput(transcript)
      }
    }
    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
      const text = transcriptRef.current.trim()
      if (text) {
        setInput('')
        handleSendRef.current(text)
      }
    }
    recognition.onerror = () => setIsListening(false)
    recognition.start()
    setIsListening(true)
  }, [isListening])

  const stopListening = useCallback(() => {
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
        const textForSpeech = data.message.replace(/\*\*(.*?)\*\*/g, '$1')
        speakResponse(textForSpeech)
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

      {/* Camera View - Shows inside chat area */}
      {showCamera && (
        <div className="absolute inset-0 bg-black z-40 flex flex-col rounded-2xl overflow-hidden">
          <div className="flex-1 relative">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            <button
              onClick={stopCamera}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-white text-center text-sm mb-3">Point at a cigar or cigar band</p>
              <div className="flex justify-center">
                <button
                  onClick={capturePhoto}
                  className="w-16 h-16 bg-white rounded-full flex items-center justify-center border-4 border-cigar-gold
                           hover:scale-105 transition-transform active:scale-95"
                >
                  <div className="w-12 h-12 bg-cigar-gold rounded-full" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
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

      {/* Suggested Questions */}
      {messages.length <= 2 && !attachedImage && (
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
      {attachedImage && (
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
        <div className="flex gap-2 items-center">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={attachedImage ? "Ask about this cigar..." : isListening ? "Listening..." : "Ask me anything..."}
            className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-cigar-gold focus:border-transparent
                     placeholder-gray-400 text-cigar-dark"
            rows={1}
          />
          <button
            onClick={() => setVoiceMode(!voiceMode)}
            className={`p-2.5 rounded-xl transition-colors ${
              voiceMode ? 'bg-cigar-gold text-cigar-dark' : 'bg-cigar-cream hover:bg-cigar-gold/30 text-cigar-dark'
            }`}
            title={voiceMode ? "Voice mode on - responses will be read aloud" : "Voice mode off - tap to enable"}
          >
            {voiceMode ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button
            onClick={() => startCamera()}
            className="bg-cigar-cream hover:bg-cigar-gold/30 text-cigar-dark p-2.5 rounded-xl transition-colors"
            title="Take a photo"
          >
            <Camera className="w-5 h-5" />
          </button>
          {getSpeechRecognition() ? (
            <button
              onClick={isListening ? stopListening : startListening}
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
