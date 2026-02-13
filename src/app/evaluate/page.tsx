'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, CheckCircle, XCircle, AlertCircle, Loader2, BarChart3, Target, Shield, Clock, Trash2, RefreshCw, Eye, TrendingUp, Zap } from 'lucide-react'

interface EvaluationResult {
  id: string
  timestamp: string
  confidence: number
  confidenceLevel: string
  identified: boolean
  identifiedCigar: string | null
  guardrailPassed: boolean
  guardrailMessage: string
  responseTime: number
  meetsThreshold: boolean
  aiResponse?: string
  notes?: string
  imageData?: string
}

interface Stats {
  totalTests: number
  avgConfidence: number
  guardrailPassRate: number
  avgResponseTime: number
  identificationRate: number
}

export default function EvaluatePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<EvaluationResult[]>([])
  const [stats, setStats] = useState<Stats>({ totalTests: 0, avgConfidence: 0, guardrailPassRate: 0, avgResponseTime: 0, identificationRate: 0 })
  const [selectedEval, setSelectedEval] = useState<EvaluationResult | null>(null)
  const [filter, setFilter] = useState<'all' | 'identified' | 'not_identified'>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/evaluate?action=history')
      const data = await res.json()
      if (data.evaluations) {
        setHistory(data.evaluations)
      }
      if (data.stats) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to load history:', error)
    }
  }

  const evaluateImage = async (imageData: string) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData })
      })
      await res.json()
      await loadHistory()
    } catch (error) {
      console.error('Evaluation error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const clearAllHistory = async () => {
    if (!confirm('Clear all evaluation history?')) return
    try {
      await fetch('/api/evaluate', { method: 'DELETE' })
      await loadHistory()
      setSelectedEval(null)
    } catch (error) {
      console.error('Failed to clear history:', error)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => evaluateImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const filteredHistory = history.filter(item => {
    if (filter === 'identified') return item.identified
    if (filter === 'not_identified') return !item.identified
    return true
  })

  const identifiedResults = history.filter(h => h.identified)
  const notIdentifiedResults = history.filter(h => !h.identified)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-amber-400" />
                </div>
                Cigar Recognition Evaluation
              </h1>
              <p className="text-gray-400 mt-1">AI image recognition performance dashboard</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadHistory}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {isLoading ? 'Testing...' : 'Test Image'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          <div className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Target className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-gray-400 text-sm">Total Tests</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.totalTests}</p>
          </div>
          
          <div className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-gray-400 text-sm">Identified</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.identificationRate}<span className="text-lg text-gray-500">%</span></p>
          </div>
          
          <div className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-gray-400 text-sm">Avg Confidence</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.avgConfidence}<span className="text-lg text-gray-500">%</span></p>
          </div>
          
          <div className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-gray-400 text-sm">Guardrail Pass</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.guardrailPassRate}<span className="text-lg text-gray-500">%</span></p>
          </div>
          
          <div className="bg-white/5 backdrop-blur rounded-2xl p-5 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Zap className="w-5 h-5 text-orange-400" />
              </div>
              <span className="text-gray-400 text-sm">Avg Response</span>
            </div>
            <p className="text-3xl font-bold text-white">{stats.avgResponseTime}<span className="text-lg text-gray-500">ms</span></p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-3 gap-6">
          {/* Results List */}
          <div className="col-span-2 bg-white/5 backdrop-blur rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Evaluation Results</h2>
              <div className="flex items-center gap-2">
                <div className="flex bg-white/10 rounded-lg p-1">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${filter === 'all' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    All ({history.length})
                  </button>
                  <button
                    onClick={() => setFilter('identified')}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${filter === 'identified' ? 'bg-green-500/30 text-green-300' : 'text-gray-400 hover:text-white'}`}
                  >
                    Identified ({identifiedResults.length})
                  </button>
                  <button
                    onClick={() => setFilter('not_identified')}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${filter === 'not_identified' ? 'bg-yellow-500/30 text-yellow-300' : 'text-gray-400 hover:text-white'}`}
                  >
                    Not ID ({notIdentifiedResults.length})
                  </button>
                </div>
                {history.length > 0 && (
                  <button onClick={clearAllHistory} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="max-h-[600px] overflow-y-auto">
              {filteredHistory.length === 0 ? (
                <div className="p-12 text-center">
                  <BarChart3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No evaluations yet</p>
                  <p className="text-gray-500 text-sm mt-1">Upload an image to start testing</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filteredHistory.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => setSelectedEval(item)}
                      className={`p-4 hover:bg-white/5 cursor-pointer transition-colors ${selectedEval?.id === item.id ? 'bg-white/10' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Image Thumbnail */}
                        <div className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 ${
                          item.confidence >= 80 ? 'border-green-500' :
                          item.confidence >= 75 ? 'border-yellow-500' : 'border-red-500'
                        }`}>
                          {item.imageData ? (
                            <img 
                              src={item.imageData} 
                              alt="Test image" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className={`w-full h-full flex items-center justify-center text-lg font-bold ${
                              item.confidence >= 80 ? 'text-green-400 bg-green-500/10' :
                              item.confidence >= 75 ? 'text-yellow-400 bg-yellow-500/10' : 
                              'text-red-400 bg-red-500/10'
                            }`}>
                              {item.confidence}%
                            </div>
                          )}
                        </div>
                        
                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {item.identified ? (
                              <>
                                <CheckCircle className="w-4 h-4 text-green-400" />
                                <span className="text-white font-medium">{item.identifiedCigar}</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-4 h-4 text-yellow-400" />
                                <span className="text-gray-400">Asked for clarification</span>
                              </>
                            )}
                            <span className={`ml-2 text-sm font-bold ${
                              item.confidence >= 80 ? 'text-green-400' :
                              item.confidence >= 75 ? 'text-yellow-400' : 'text-red-400'
                            }`}>{item.confidence}%</span>
                          </div>
                          <p className="text-gray-500 text-sm truncate">{item.notes || item.aiResponse}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span>{formatDate(item.timestamp)}</span>
                            <span>•</span>
                            <span>{item.responseTime}ms</span>
                            <span>•</span>
                            <span className={item.guardrailPassed ? 'text-green-400' : 'text-red-400'}>
                              Guardrail {item.guardrailPassed ? '✓' : '✗'}
                            </span>
                          </div>
                        </div>
                        
                        <Eye className="w-5 h-5 text-gray-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Detail Panel */}
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
            {selectedEval ? (
              <div className="space-y-6">
                {/* Image Preview */}
                <div className={`rounded-xl overflow-hidden border-2 ${
                  selectedEval.confidence >= 80 ? 'border-green-500' :
                  selectedEval.confidence >= 75 ? 'border-yellow-500' : 'border-red-500'
                }`}>
                  {selectedEval.imageData ? (
                    <img 
                      src={selectedEval.imageData} 
                      alt="Evaluated cigar" 
                      className="w-full h-56 object-cover bg-black/50"
                    />
                  ) : (
                    <div className="w-full h-56 bg-white/5 flex items-center justify-center">
                      <span className="text-gray-500">No image available</span>
                    </div>
                  )}
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {selectedEval.identified ? selectedEval.identifiedCigar : 'Not Identified'}
                  </h3>
                  <p className="text-gray-400 text-sm">{formatDate(selectedEval.timestamp)}</p>
                </div>
                
                {/* Confidence Meter */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Confidence</span>
                    <span className={`font-bold ${
                      selectedEval.confidence >= 80 ? 'text-green-400' :
                      selectedEval.confidence >= 75 ? 'text-yellow-400' : 'text-red-400'
                    }`}>{selectedEval.confidence}%</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        selectedEval.confidence >= 80 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                        selectedEval.confidence >= 75 ? 'bg-gradient-to-r from-yellow-500 to-amber-400' : 
                        'bg-gradient-to-r from-red-500 to-rose-400'
                      }`}
                      style={{ width: `${selectedEval.confidence}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-gray-500">
                    <span>0%</span>
                    <span className="text-amber-500">75% threshold</span>
                    <span>100%</span>
                  </div>
                </div>
                
                {/* Status Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500 uppercase mb-1">Status</p>
                    <p className={`font-medium capitalize ${
                      selectedEval.confidenceLevel === 'high' ? 'text-green-400' :
                      selectedEval.confidenceLevel === 'medium' ? 'text-yellow-400' : 'text-red-400'
                    }`}>{selectedEval.confidenceLevel}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500 uppercase mb-1">Response</p>
                    <p className="font-medium text-white">{selectedEval.responseTime}ms</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500 uppercase mb-1">Guardrail</p>
                    <p className={`font-medium ${selectedEval.guardrailPassed ? 'text-green-400' : 'text-red-400'}`}>
                      {selectedEval.guardrailPassed ? 'Passed' : 'Failed'}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-500 uppercase mb-1">Threshold</p>
                    <p className={`font-medium ${selectedEval.meetsThreshold ? 'text-green-400' : 'text-red-400'}`}>
                      {selectedEval.meetsThreshold ? 'Met' : 'Below'}
                    </p>
                  </div>
                </div>
                
                {/* AI Response */}
                {selectedEval.aiResponse && (
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs text-gray-500 uppercase mb-2">AI Response</p>
                    <p className="text-gray-300 text-sm leading-relaxed">{selectedEval.aiResponse}</p>
                  </div>
                )}
                
                {/* Notes */}
                {selectedEval.notes && (
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-xs text-gray-500 uppercase mb-2">Test Notes</p>
                    <p className="text-gray-400 text-sm">{selectedEval.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="p-4 bg-white/5 rounded-full mb-4">
                  <Eye className="w-8 h-8 text-gray-500" />
                </div>
                <p className="text-gray-400 font-medium">Select an evaluation</p>
                <p className="text-gray-500 text-sm mt-1">Click on a result to view details</p>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-6">
          <h3 className="text-white font-semibold mb-4">Confidence Threshold Guide</h3>
          <div className="grid grid-cols-3 gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
                <span className="text-red-400 font-bold">0-74</span>
              </div>
              <div>
                <p className="text-white font-medium">Low Confidence</p>
                <p className="text-gray-400 text-sm">Asks clarifying questions</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 border-2 border-yellow-500 flex items-center justify-center">
                <span className="text-yellow-400 font-bold">75-79</span>
              </div>
              <div>
                <p className="text-white font-medium">Medium Confidence</p>
                <p className="text-gray-400 text-sm">Identifies with caution</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                <span className="text-green-400 font-bold">80+</span>
              </div>
              <div>
                <p className="text-white font-medium">High Confidence</p>
                <p className="text-gray-400 text-sm">Confident identification</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
