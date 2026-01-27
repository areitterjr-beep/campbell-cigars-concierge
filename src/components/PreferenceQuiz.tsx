'use client'

import { useState } from 'react'
import { ChevronRight, ChevronLeft, Sparkles, Loader2 } from 'lucide-react'
import CigarInfoCard from './CigarInfoCard'

interface PreferenceQuizProps {
  onComplete: (preferences: string) => void
  onCancel: () => void
}

interface Answer {
  question: string
  answer: string
}

interface CigarCardData {
  name: string
  brand: string
  origin: string
  wrapper: string
  body: string
  strength: string
  price: string
  time: string
  description: string
  tastingNotes: string[]
  pairings: { alcoholic: string[]; nonAlcoholic: string[] }
  inStock: boolean
  imageUrl?: string
}

const QUESTIONS = [
  {
    id: 'experience',
    question: 'How would you describe your cigar experience?',
    options: [
      { value: 'beginner', label: 'New to cigars', description: "I'm just starting out" },
      { value: 'casual', label: 'Casual smoker', description: 'Occasional enjoyment' },
      { value: 'enthusiast', label: 'Enthusiast', description: 'Regular smoker with preferences' },
      { value: 'connoisseur', label: 'Connoisseur', description: 'Experienced with diverse tastes' },
    ],
  },
  {
    id: 'strength',
    question: 'What strength do you prefer?',
    options: [
      { value: 'mild', label: 'Mild', description: 'Smooth and subtle' },
      { value: 'mild-medium', label: 'Mild to Medium', description: 'Gentle with some complexity' },
      { value: 'medium', label: 'Medium', description: 'Balanced and flavorful' },
      { value: 'medium-full', label: 'Medium to Full', description: 'Rich and bold' },
      { value: 'full', label: 'Full', description: 'Powerful and intense' },
    ],
  },
  {
    id: 'flavors',
    question: 'Which flavor profiles appeal to you most?',
    options: [
      { value: 'creamy', label: 'Creamy & Smooth', description: 'Cream, vanilla, almond' },
      { value: 'spicy', label: 'Spicy & Peppery', description: 'Black pepper, red pepper, spice' },
      { value: 'sweet', label: 'Sweet & Rich', description: 'Chocolate, caramel, dried fruit' },
      { value: 'earthy', label: 'Earthy & Woody', description: 'Cedar, leather, earth' },
      { value: 'coffee', label: 'Coffee & Cocoa', description: 'Espresso, dark chocolate, mocha' },
    ],
  },
  {
    id: 'time',
    question: 'How much time do you have to smoke?',
    options: [
      { value: 'short', label: 'Quick Break', description: '20-30 minutes' },
      { value: 'medium', label: 'Relaxed Session', description: '45-60 minutes' },
      { value: 'long', label: 'Extended Enjoyment', description: '60-90+ minutes' },
    ],
  },
  {
    id: 'occasion',
    question: 'What occasion is this for?',
    options: [
      { value: 'everyday', label: 'Everyday Smoke', description: 'Regular enjoyment' },
      { value: 'celebration', label: 'Celebration', description: 'Special occasion' },
      { value: 'social', label: 'Social Gathering', description: 'With friends' },
      { value: 'relaxation', label: 'Evening Relaxation', description: 'Unwinding after a day' },
      { value: 'pairing', label: 'Drink Pairing', description: 'With whiskey, wine, coffee, etc.' },
    ],
  },
]

export default function PreferenceQuiz({ onComplete, onCancel }: PreferenceQuizProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [recommendations, setRecommendations] = useState<string | null>(null)
  const [recommendedCigars, setRecommendedCigars] = useState<CigarCardData[]>([])

  const currentQuestion = QUESTIONS[currentStep]
  const isLastQuestion = currentStep === QUESTIONS.length - 1

  const handleNext = () => {
    if (!selectedOption) return

    const newAnswers = [
      ...answers,
      { question: currentQuestion.question, answer: selectedOption },
    ]
    setAnswers(newAnswers)
    setSelectedOption(null)

    if (isLastQuestion) {
      getRecommendations(newAnswers)
    } else {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
      const previousAnswer = answers[currentStep - 1]
      setSelectedOption(previousAnswer?.answer || null)
      setAnswers((prev) => prev.slice(0, -1))
    }
  }

  const getRecommendations = async (finalAnswers: Answer[]) => {
    setIsLoading(true)
    
    try {
      const preferenceSummary = finalAnswers
        .map((a) => `${a.question}: ${a.answer}`)
        .join('\n')

      const response = await fetch('/api/quiz-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: preferenceSummary,
        }),
      })

      const data = await response.json()
      setRecommendations(data.message)
      setRecommendedCigars(data.cigars || [])
    } catch (error) {
      console.error('Recommendation error:', error)
      setRecommendations('Unable to generate recommendations. Please try asking our AI assistant directly!')
      setRecommendedCigars([])
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <Loader2 className="w-12 h-12 animate-spin text-cigar-gold mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-cigar-dark mb-2">
          Finding Your Perfect Matches...
        </h3>
        <p className="text-gray-600">
          Our AI is analyzing your preferences
        </p>
      </div>
    )
  }

  if (recommendations) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-cigar-gold flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-cigar-dark" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-cigar-dark">
                Your Personalized Recommendations
              </h3>
              <p className="text-gray-600 text-sm">Based on your preferences</p>
            </div>
          </div>

          {recommendations && (
            <p className="text-gray-700 mb-4">{recommendations}</p>
          )}
        </div>

        {/* Cigar Cards */}
        {recommendedCigars.length > 0 && (
          <div className={`grid gap-4 ${
            recommendedCigars.length === 1 
              ? 'grid-cols-1 max-w-md mx-auto' 
              : 'grid-cols-1 md:grid-cols-2'
          }`}>
            {recommendedCigars.map((cigar, idx) => (
              <CigarInfoCard key={idx} cigar={cigar} fullWidth />
            ))}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={() => {
              setRecommendations(null)
              setRecommendedCigars([])
              setCurrentStep(0)
              setAnswers([])
              setSelectedOption(null)
            }}
            className="flex-1 border-2 border-cigar-gold text-cigar-dark font-semibold 
                     py-3 px-6 rounded-xl hover:bg-cigar-cream transition-colors"
          >
            Retake Quiz
          </button>
          <button
            onClick={() => onComplete(recommendations)}
            className="flex-1 bg-cigar-gold hover:bg-cigar-amber text-cigar-dark 
                     font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Ask More Questions
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>Question {currentStep + 1} of {QUESTIONS.length}</span>
          <span>{Math.round(((currentStep + 1) / QUESTIONS.length) * 100)}%</span>
        </div>
        <div className="h-2 bg-cigar-cream rounded-full overflow-hidden">
          <div
            className="h-full bg-cigar-gold transition-all duration-300"
            style={{ width: `${((currentStep + 1) / QUESTIONS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <h3 className="text-xl font-semibold text-cigar-dark mb-6">
        {currentQuestion.question}
      </h3>

      {/* Options */}
      <div className="space-y-3 mb-8">
        {currentQuestion.options.map((option) => (
          <button
            key={option.value}
            onClick={() => setSelectedOption(option.value)}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
              selectedOption === option.value
                ? 'border-cigar-gold bg-cigar-gold/10'
                : 'border-gray-200 hover:border-cigar-gold/50 hover:bg-cigar-cream/30'
            }`}
          >
            <div className="font-medium text-cigar-dark">{option.label}</div>
            <div className="text-sm text-gray-500">{option.description}</div>
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-4">
        {currentStep > 0 ? (
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-6 py-3 border-2 border-gray-200 
                     rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
        ) : (
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-6 py-3 border-2 border-gray-200 
                     rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
        
        <button
          onClick={handleNext}
          disabled={!selectedOption}
          className="flex-1 flex items-center justify-center gap-2 bg-cigar-gold 
                   hover:bg-cigar-amber disabled:bg-gray-300 text-cigar-dark 
                   font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          {isLastQuestion ? 'Get Recommendations' : 'Next'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
