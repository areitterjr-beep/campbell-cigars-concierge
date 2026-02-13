'use client'

import { MessageCircle, Compass } from 'lucide-react'

type Tab = 'chat' | 'discover'

interface NavigationProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const tabs = [
    { id: 'chat' as Tab, label: 'Ask Expert', icon: MessageCircle },
    { id: 'discover' as Tab, label: 'Discover', icon: Compass },
  ]

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-2">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-4 px-2 
                           transition-all duration-200 border-b-3 font-medium
                           ${isActive 
                             ? 'text-cigar-gold border-b-2 border-cigar-gold bg-cigar-cream/30' 
                             : 'text-gray-500 border-b-2 border-transparent hover:text-cigar-brown hover:bg-cigar-cream/20'
                           }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-cigar-gold' : ''}`} />
                <span className="text-sm md:text-base">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
