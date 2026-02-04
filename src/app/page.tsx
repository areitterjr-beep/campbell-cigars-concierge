'use client'

import { useState } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import Navigation from '@/components/Navigation'
import ChatInterface from '@/components/ChatInterface'
import PreferenceQuiz from '@/components/PreferenceQuiz'

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

  const handleChatEngaged = () => {
    setChatEngaged(true)
  }

  const handleQuizComplete = (preferences: string) => {
    setShowQuiz(false)
    setActiveTab('chat')
    // The preferences will be passed to the chat to start a conversation
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
      <header className={`bg-cigar-dark text-cigar-cream px-4 shadow-lg relative transition-all duration-300 ${
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
        
        <div className="max-w-4xl mx-auto text-center">
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
      <div className={`flex-1 max-w-4xl mx-auto w-full transition-all duration-300 ${
        isExpandedChat ? 'p-0' : 'p-4'
      }`}>
        {activeTab === 'chat' && !showQuiz && (
          <div className="h-full">
            <ChatInterface 
              isExpanded={isExpandedChat} 
              onEngaged={handleChatEngaged} 
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
                      recommendation="Try: Ashton Classic or Montecristo White"
                    />
                    <QuickGuideCard
                      title="Looking for Bold Flavors?"
                      description="Full-bodied Nicaraguan cigars with Maduro wrappers deliver rich, complex flavors with notes of chocolate and espresso."
                      recommendation="Try: Liga Privada No. 9 or Padron 1964"
                    />
                    <QuickGuideCard
                      title="Short on Time?"
                      description="Petit coronas and short perfectos offer a complete smoking experience in 30-45 minutes."
                      recommendation="Try: Arturo Fuente Hemingway Short Story"
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
    </main>
  )
}

function QuickGuideCard({ 
  title, 
  description, 
  recommendation 
}: { 
  title: string
  description: string
  recommendation: string 
}) {
  return (
    <div className="bg-cigar-cream/50 rounded-xl p-4 border border-cigar-gold/20">
      <h4 className="font-semibold text-cigar-dark mb-2">{title}</h4>
      <p className="text-gray-600 text-sm mb-2">{description}</p>
      <p className="text-cigar-amber text-sm font-medium">{recommendation}</p>
    </div>
  )
}
