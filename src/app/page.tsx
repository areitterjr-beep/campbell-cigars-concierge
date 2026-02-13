'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import Navigation from '@/components/Navigation'
import ChatInterface from '@/components/ChatInterface'
import PreferenceQuiz from '@/components/PreferenceQuiz'

const INACTIVITY_TIMEOUT_MS = 30 * 1000 // 30 seconds of inactivity before showing countdown
const COUNTDOWN_SECONDS = 20

type Tab = 'chat' | 'discover'

export interface CigarInfo {
  id: string
  name: string
  brand: string
  origin: string
  wrapper: string
  body: string
  strength: string
  description: string
  tastingNotes: string[]
  pairings: {
    alcoholic: string[]
    nonAlcoholic: string[]
  }
  priceRange: string
  smokingTime: string
  bestFor: string[]
}

export default function Home() {
  const [showLanding, setShowLanding] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [showQuiz, setShowQuiz] = useState(false)
  const [chatEngaged, setChatEngaged] = useState(false)
  const [pendingCigarQuery, setPendingCigarQuery] = useState<string | null>(null)

  // Inactivity timer
  const [showCountdown, setShowCountdown] = useState(false)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownActiveRef = useRef(false) // ref to avoid stale closures

  const clearAllTimers = useCallback(() => {
    if (inactivityTimerRef.current) { clearTimeout(inactivityTimerRef.current); inactivityTimerRef.current = null }
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null }
  }, [])

  const resetToLanding = useCallback(() => {
    clearAllTimers()
    countdownActiveRef.current = false
    setShowCountdown(false)
    setCountdown(COUNTDOWN_SECONDS)
    setShowLanding(true)
    setChatEngaged(false)
    setShowQuiz(false)
    setActiveTab('chat')
  }, [clearAllTimers])

  const startInactivityTimer = useCallback(() => {
    clearAllTimers()
    inactivityTimerRef.current = setTimeout(() => {
      // Show countdown
      countdownActiveRef.current = true
      setShowCountdown(true)
      setCountdown(COUNTDOWN_SECONDS)
      let remaining = COUNTDOWN_SECONDS
      countdownIntervalRef.current = setInterval(() => {
        remaining -= 1
        if (remaining <= 0) {
          // Time's up
          resetToLanding()
        } else {
          setCountdown(remaining)
        }
      }, 1000)
    }, INACTIVITY_TIMEOUT_MS)
  }, [clearAllTimers, resetToLanding])

  const handleStillHere = useCallback(() => {
    clearAllTimers()
    countdownActiveRef.current = false
    setShowCountdown(false)
    setCountdown(COUNTDOWN_SECONDS)
    startInactivityTimer()
  }, [clearAllTimers, startInactivityTimer])

  // Keep a ref to startInactivityTimer so event handlers always use the latest version
  const startTimerRef = useRef(startInactivityTimer)
  startTimerRef.current = startInactivityTimer

  // Listen for user activity to reset the inactivity timer
  useEffect(() => {
    if (showLanding) {
      clearAllTimers()
      countdownActiveRef.current = false
      return
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'input']
    let throttled = false
    const onActivity = () => {
      // Don't reset if countdown modal is showing — user must click a button
      if (countdownActiveRef.current) return
      // Throttle to avoid resetting on every pixel of mouse movement
      if (throttled) return
      throttled = true
      setTimeout(() => { throttled = false }, 1000)
      startTimerRef.current()
    }

    events.forEach(e => window.addEventListener(e, onActivity, { passive: true, capture: true }))
    startTimerRef.current() // Start the timer

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity, { capture: true }))
      clearAllTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLanding])

  const handleChatEngaged = () => {
    setChatEngaged(true)
  }

  const handleQuizComplete = (preferences: string) => {
    setShowQuiz(false)
    setActiveTab('chat')
  }

  // Landing Page
  if (showLanding) {
    return (
      <main className="min-h-screen bg-cigar-dark flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-md">
          {/* Logo */}
          <div className="mb-1">
            <img 
              src="/logo.png" 
              alt="Campbell Cigar Club" 
              className="w-48 h-auto mx-auto"
            />
          </div>
          
          <h2 className="text-xl md:text-2xl font-normal text-cigar-cream mb-6">
            Concierge
          </h2>
          
          <p className="text-cigar-cream/70 text-lg mb-10">
            Your personal expert guide to the world of fine cigars
          </p>
          
          {/* Start Button */}
          <button
            onClick={() => setShowLanding(false)}
            className="bg-cigar-gold hover:bg-cigar-amber text-cigar-dark font-semibold 
                     text-lg py-4 px-12 rounded-full transition-all duration-300 
                     shadow-lg hover:shadow-xl hover:scale-105"
          >
            Start
          </button>
        </div>
        
        {/* Subtle footer */}
        <p className="absolute bottom-6 text-cigar-cream/40 text-sm">
          Tap to begin your journey
        </p>
      </main>
    )
  }

  const isExpandedChat = chatEngaged && activeTab === 'chat'

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header with Close Button - compact when chat is engaged */}
      <header className={`bg-cigar-dark text-cigar-cream px-2 shadow-lg relative transition-all duration-300 ${
        isExpandedChat ? 'py-3' : 'py-6'
      }`}>
        <button
          onClick={() => {
            setShowLanding(true)
            setChatEngaged(false)
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full
                   hover:bg-white/10 transition-colors"
          title="Back to welcome"
        >
          <X className="w-6 h-6 text-cigar-cream/80 hover:text-cigar-cream" />
        </button>

        {/* Expand/Collapse toggle - always visible in chat tab */}
        {activeTab === 'chat' && (
          <button
            onClick={() => setChatEngaged(!chatEngaged)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full
                     hover:bg-white/10 transition-colors"
            title={isExpandedChat ? "Show navigation" : "Expand chat"}
          >
            {isExpandedChat ? (
              <ChevronDown className="w-6 h-6 text-cigar-cream/80 hover:text-cigar-cream" />
            ) : (
              <ChevronUp className="w-6 h-6 text-cigar-cream/80 hover:text-cigar-cream" />
            )}
          </button>
        )}
        
        <div className="max-w-6xl mx-auto text-center">
          <h1 className={`font-bold tracking-wide transition-all duration-300 ${
            isExpandedChat ? 'text-xl md:text-2xl' : 'text-3xl md:text-4xl'
          }`}>
            <span className="text-cigar-gold">Campbell Cigars</span> Concierge
          </h1>
          {!isExpandedChat && (
            <p className="text-sm md:text-base mt-2 text-cigar-cream/80">
              Your Personal Expert Guide to the World of Fine Cigars
            </p>
          )}
        </div>
      </header>

      {/* Navigation - hidden when chat is engaged */}
      {!isExpandedChat && (
        <Navigation activeTab={activeTab} onTabChange={(tab) => {
          setActiveTab(tab)
          if (tab !== 'chat') setChatEngaged(false)
          if (tab === 'chat') setShowQuiz(false)
        }} />
      )}

      {/* Main Content */}
      <div className={`flex-1 max-w-6xl mx-auto w-full transition-all duration-300 ${
        isExpandedChat ? 'p-0' : 'px-2 py-4'
      }`}>
        {activeTab === 'chat' && !showQuiz && (
          <div className="h-full">
            <ChatInterface 
              isExpanded={isExpandedChat} 
              onEngaged={handleChatEngaged}
              pendingQuery={pendingCigarQuery}
              onPendingQueryConsumed={() => setPendingCigarQuery(null)}
            />
          </div>
        )}

        {activeTab === 'discover' && (
          <div className="space-y-6">
            {showQuiz ? (
              <PreferenceQuiz onComplete={handleQuizComplete} onCancel={() => setShowQuiz(false)} />
            ) : (
              <>
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h2 className="text-xl font-semibold text-cigar-dark mb-4">
                    Find Your Perfect Cigar
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Tell us about your preferences and experience level, and we&apos;ll help you 
                    discover cigars you&apos;ll love.
                  </p>
                  
                  <button
                    onClick={() => setShowQuiz(true)}
                    className="w-full bg-cigar-gold hover:bg-cigar-amber text-cigar-dark font-semibold 
                             py-4 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    Take the Preference Quiz
                  </button>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-cigar-dark mb-4">
                    Quick Start Guides
                  </h3>
                  <div className="grid gap-4">
                    <QuickGuideCard
                      title="New to Cigars?"
                      description="Start with mild, Connecticut-wrapped cigars. They're smooth, approachable, and won't overwhelm your palate."
                      cigars={['Ashton Crystal Belicoso', 'Montecristo White Series']}
                      onCigarClick={(name) => {
                        setActiveTab('chat')
                        setChatEngaged(true)
                        setPendingCigarQuery(`Tell me about the ${name}`)
                      }}
                    />
                    <QuickGuideCard
                      title="Looking for Bold Flavors?"
                      description="Full-bodied Nicaraguan cigars with Maduro wrappers deliver rich, complex flavors with notes of chocolate and espresso."
                      cigars={['Liga Privada No. 9', 'Padron 1964 Anniversary Maduro']}
                      onCigarClick={(name) => {
                        setActiveTab('chat')
                        setChatEngaged(true)
                        setPendingCigarQuery(`Tell me about the ${name}`)
                      }}
                    />
                    <QuickGuideCard
                      title="Short on Time?"
                      description="Petit coronas and short perfectos offer a complete smoking experience in 30-45 minutes."
                      cigars={['Arturo Fuente Hemingway Short Story']}
                      onCigarClick={(name) => {
                        setActiveTab('chat')
                        setChatEngaged(true)
                        setPendingCigarQuery(`Tell me about the ${name}`)
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer - hidden when chat is engaged */}
      {!isExpandedChat && (
        <footer className="bg-cigar-dark text-cigar-cream/60 py-4 px-4 text-center text-sm">
          <p>Ask our concierge anything about cigars. We&apos;re here to help!</p>
        </footer>
      )}

      {/* Inactivity Countdown Overlay */}
      {showCountdown && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-4 text-center">
            <div className="w-16 h-16 rounded-full bg-cigar-gold/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl font-bold text-cigar-dark">{countdown}</span>
            </div>
            <h3 className="text-xl font-semibold text-cigar-dark mb-2">
              Are you still there?
            </h3>
            <p className="text-gray-600 text-sm mb-6">
              This session will return to the home screen in {countdown} second{countdown !== 1 ? 's' : ''}.
            </p>
            <div className="flex gap-3">
              <button
                onClick={resetToLanding}
                className="flex-1 border-2 border-cigar-gold text-cigar-dark font-semibold 
                         py-3 px-4 rounded-xl hover:bg-cigar-cream transition-colors"
              >
                No, I&apos;m done
              </button>
              <button
                onClick={handleStillHere}
                className="flex-1 bg-cigar-gold hover:bg-cigar-amber text-cigar-dark 
                         font-semibold py-3 px-4 rounded-xl transition-colors"
              >
                Yes, I need more time
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function QuickGuideCard({ 
  title, 
  description, 
  cigars,
  onCigarClick,
}: { 
  title: string
  description: string
  cigars: string[]
  onCigarClick: (name: string) => void
}) {
  return (
    <div className="bg-cigar-cream/50 rounded-xl p-4 border border-cigar-gold/20">
      <h4 className="font-semibold text-cigar-dark mb-2">{title}</h4>
      <p className="text-gray-600 text-sm mb-2">{description}</p>
      <p className="text-sm font-medium text-cigar-amber">
        Try:{' '}
        {cigars.map((name, i) => (
          <span key={name}>
            {i > 0 && ' or '}
            <button
              onClick={() => onCigarClick(name)}
              className="underline decoration-cigar-gold/50 underline-offset-2 
                       hover:text-cigar-gold transition-colors cursor-pointer"
            >
              {name}
            </button>
          </span>
        ))}
      </p>
    </div>
  )
}
