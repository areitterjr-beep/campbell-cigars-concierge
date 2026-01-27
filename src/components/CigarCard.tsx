'use client'

import { Wine, Coffee, Clock, Gauge, MapPin, Leaf } from 'lucide-react'
import type { CigarInfo } from '@/app/page'

interface CigarCardProps {
  cigar: CigarInfo
  showInventory?: boolean
}

export default function CigarCard({ cigar, showInventory = false }: CigarCardProps) {
  const getBodyColor = (body: string) => {
    const bodyLower = body.toLowerCase()
    if (bodyLower.includes('light')) return 'bg-amber-100 text-amber-800'
    if (bodyLower.includes('medium')) return 'bg-orange-100 text-orange-800'
    if (bodyLower.includes('full')) return 'bg-red-100 text-red-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-cigar-dark text-cigar-cream p-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-cigar-gold">{cigar.name}</h3>
            <p className="text-cigar-cream/70">{cigar.brand}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getBodyColor(cigar.body)}`}>
            {cigar.body}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="p-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 text-gray-700">
            <div className="w-10 h-10 rounded-full bg-cigar-cream flex items-center justify-center">
              <MapPin className="w-5 h-5 text-cigar-gold" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Origin</p>
              <p className="font-medium">{cigar.origin}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-gray-700">
            <div className="w-10 h-10 rounded-full bg-cigar-cream flex items-center justify-center">
              <Gauge className="w-5 h-5 text-cigar-gold" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Strength</p>
              <p className="font-medium">{cigar.strength}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-gray-700">
            <div className="w-10 h-10 rounded-full bg-cigar-cream flex items-center justify-center">
              <Clock className="w-5 h-5 text-cigar-gold" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Smoke Time</p>
              <p className="font-medium">{cigar.smokingTime}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 text-gray-700">
            <div className="w-10 h-10 rounded-full bg-cigar-cream flex items-center justify-center">
              <Leaf className="w-5 h-5 text-cigar-gold" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Wrapper</p>
              <p className="font-medium text-sm">{cigar.wrapper}</p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <h4 className="font-semibold text-cigar-dark mb-2">Description</h4>
          <p className="text-gray-600">{cigar.description}</p>
        </div>

        {/* Tasting Notes */}
        <div>
          <h4 className="font-semibold text-cigar-dark mb-3">Tasting Notes</h4>
          <div className="flex flex-wrap gap-2">
            {cigar.tastingNotes.map((note, index) => (
              <span
                key={index}
                className="bg-cigar-cream text-cigar-brown px-3 py-1.5 rounded-full text-sm 
                         border border-cigar-gold/30"
              >
                {note}
              </span>
            ))}
          </div>
        </div>

        {/* Pairings */}
        <div className="space-y-4">
          <h4 className="font-semibold text-cigar-dark">Perfect Pairings</h4>
          
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Wine className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Alcoholic Beverages</p>
              <p className="text-gray-700">{cigar.pairings.alcoholic.join(', ')}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Coffee className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Non-Alcoholic Options</p>
              <p className="text-gray-700">{cigar.pairings.nonAlcoholic.join(', ')}</p>
            </div>
          </div>
        </div>

        {/* Best For */}
        <div>
          <h4 className="font-semibold text-cigar-dark mb-3">Best For</h4>
          <div className="flex flex-wrap gap-2">
            {cigar.bestFor.map((item, index) => (
              <span
                key={index}
                className="bg-cigar-gold/20 text-cigar-dark px-3 py-1.5 rounded-full text-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Price */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
          <span className="text-gray-500">Price Range</span>
          <span className="text-xl font-bold text-cigar-gold">{cigar.priceRange}</span>
        </div>

        {showInventory && 'inventory' in cigar && (
          <div className="flex justify-between items-center pt-2">
            <span className="text-gray-500">In Stock</span>
            <span className={`font-bold ${
              (cigar as any).inventory > 10 ? 'text-green-600' : 
              (cigar as any).inventory > 0 ? 'text-amber-600' : 'text-red-600'
            }`}>
              {(cigar as any).inventory} units
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
