'use client'

import { useState } from 'react'
import { Wine, Coffee } from 'lucide-react'

export interface CigarData {
  name: string
  brand: string
  origin?: string
  wrapper?: string
  body: string
  strength: string
  price: string
  time: string
  description: string
  tastingNotes: string[]
  pairings: {
    alcoholic: string[]
    nonAlcoholic: string[]
  }
  inStock?: boolean
  imageUrl?: string
}

interface CigarInfoCardProps {
  cigar: CigarData
  fullWidth?: boolean
}

export default function CigarInfoCard({ cigar, fullWidth = false }: CigarInfoCardProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  
  const hasValidImage = cigar.imageUrl && !imageError
  
  // Remove brand name from cigar name if it appears at the start
  const displayName = cigar.name.toLowerCase().startsWith(cigar.brand.toLowerCase())
    ? cigar.name.substring(cigar.brand.length).trim().replace(/^[-–—]/, '').trim()
    : cigar.name
  
  const getBodyStyle = (body: string) => {
    const b = body.toLowerCase()
    if (b.includes('light') && !b.includes('medium')) return { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-800', label: 'Light' }
    if (b.includes('light-medium')) return { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-800', label: 'Light-Med' }
    if (b === 'medium') return { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800', label: 'Medium' }
    if (b.includes('medium-full')) return { bg: 'bg-orange-200', border: 'border-orange-500', text: 'text-orange-900', label: 'Med-Full' }
    if (b.includes('full')) return { bg: 'bg-red-100', border: 'border-red-400', text: 'text-red-800', label: 'Full' }
    return { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800', label: body }
  }

  const getStrengthLevel = (strength: string) => {
    const s = strength.toLowerCase()
    if (s === 'mild') return 1
    if (s.includes('mild-medium') || s.includes('mild to medium')) return 2
    if (s === 'medium') return 3
    if (s.includes('medium-full') || s.includes('medium to full')) return 4
    if (s === 'full') return 5
    return 3
  }

  const bodyStyle = getBodyStyle(cigar.body)
  const strengthLevel = getStrengthLevel(cigar.strength)

  return (
    <div className={`bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden ${
      fullWidth ? 'w-full' : 'w-80 flex-shrink-0'
    }`}>
      {/* Image Section */}
      {hasValidImage && (
        <div className="relative h-44 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-3 border-cigar-gold border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <img 
            src={cigar.imageUrl}
            alt={cigar.name}
            className={`max-h-40 max-w-[90%] object-contain transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
          {cigar.inStock !== false && (
            <span className="absolute top-3 right-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
              In Stock
            </span>
          )}
        </div>
      )}

      {/* Header - Brand & Name */}
      <div className={`bg-gradient-to-r from-cigar-dark to-cigar-brown p-4 ${!hasValidImage ? 'pt-5' : ''}`}>
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-cigar-gold text-sm font-bold uppercase tracking-widest truncate drop-shadow-sm">
              {cigar.brand}
            </p>
            <h3 className="text-white/90 font-medium text-base leading-tight mt-1 truncate" title={cigar.name}>
              {displayName || cigar.name}
            </h3>
          </div>
          {!hasValidImage && cigar.inStock !== false && (
            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium flex-shrink-0">
              In Stock
            </span>
          )}
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-4 border-b border-gray-200 bg-gray-50">
        <div className="p-3 text-center border-r border-gray-200">
          <div className={`inline-block px-2 py-1 rounded text-xs font-bold border ${bodyStyle.bg} ${bodyStyle.border} ${bodyStyle.text}`}>
            {bodyStyle.label}
          </div>
          <p className="text-[10px] text-gray-500 mt-1 uppercase font-medium">Body</p>
        </div>
        
        <div className="p-3 text-center border-r border-gray-200">
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div 
                key={i} 
                className={`w-1.5 h-4 rounded-sm ${i <= strengthLevel ? 'bg-cigar-gold' : 'bg-gray-300'}`} 
              />
            ))}
          </div>
          <p className="text-[10px] text-gray-500 mt-1 uppercase font-medium">Strength</p>
        </div>
        
        <div className="p-3 text-center border-r border-gray-200">
          <p className="text-sm font-bold text-cigar-dark">{cigar.time}</p>
          <p className="text-[10px] text-gray-500 uppercase font-medium">Time</p>
        </div>
        
        <div className="p-3 text-center">
          <p className="text-sm font-bold text-cigar-gold">{cigar.price}</p>
          <p className="text-[10px] text-gray-500 uppercase font-medium">Price</p>
        </div>
      </div>

      {/* Description */}
      <div className="px-4 py-3 border-b border-gray-200">
        <p className="text-sm text-gray-700 leading-relaxed">{cigar.description}</p>
      </div>

      {/* Tasting Notes */}
      <div className="px-4 py-3 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tasting Notes</p>
        <div className="flex flex-wrap gap-1.5">
          {cigar.tastingNotes.slice(0, 5).map((note, i) => (
            <span 
              key={i} 
              className="bg-cigar-cream text-cigar-brown text-xs px-2.5 py-1 rounded-full font-medium"
            >
              {note}
            </span>
          ))}
        </div>
      </div>

      {/* Pairings */}
      <div className="px-4 py-3 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pairs With</p>
        <div className="flex items-center gap-2">
          <Wine className="w-4 h-4 text-purple-500 flex-shrink-0" />
          <p className="text-sm text-gray-700">{cigar.pairings.alcoholic.slice(0, 2).join(' · ')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Coffee className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-gray-700">{cigar.pairings.nonAlcoholic.slice(0, 2).join(' · ')}</p>
        </div>
      </div>
    </div>
  )
}
