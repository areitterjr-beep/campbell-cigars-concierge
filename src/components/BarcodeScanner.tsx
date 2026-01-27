'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, X, Loader2, Search, Upload } from 'lucide-react'
import type { CigarInfo } from '@/app/page'

interface BarcodeScannerProps {
  onScanResult: (cigar: CigarInfo) => void
}

export default function BarcodeScanner({ onScanResult }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualBarcode, setManualBarcode] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const startScanning = async () => {
    setError(null)
    setIsScanning(true)

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
      setError('Unable to access camera. Please check permissions or enter barcode manually.')
      setIsScanning(false)
    }
  }

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsScanning(false)
  }

  const captureAndScan = async () => {
    if (!videoRef.current) return

    setIsLoading(true)
    setError(null)

    try {
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(videoRef.current, 0, 0)
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8)
      
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData }),
      })

      const data = await response.json()

      if (data.cigar) {
        onScanResult(data.cigar)
        stopScanning()
      } else {
        setError(data.error || 'Could not identify cigar. Try again or enter barcode manually.')
      }
    } catch (err) {
      console.error('Scan error:', err)
      setError('Failed to scan. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleManualSearch = async () => {
    if (!manualBarcode.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: manualBarcode }),
      })

      const data = await response.json()

      if (data.cigar) {
        onScanResult(data.cigar)
        setManualBarcode('')
      } else {
        setError(data.error || 'Cigar not found in our database.')
      }
    } catch (err) {
      console.error('Search error:', err)
      setError('Failed to search. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setError(null)

    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const imageData = reader.result as string
        
        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageData }),
        })

        const data = await response.json()

        if (data.cigar) {
          onScanResult(data.cigar)
        } else {
          setError(data.error || 'Could not identify cigar from image.')
        }
        setIsLoading(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error('Upload error:', err)
      setError('Failed to process image. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Camera Scanner */}
      {isScanning ? (
        <div className="relative">
          <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            
            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-40 border-2 border-cigar-gold rounded-lg relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cigar-gold rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cigar-gold rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cigar-gold rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cigar-gold rounded-br-lg" />
                
                {/* Scanning line animation */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="h-0.5 bg-cigar-gold/80 w-full animate-bounce" />
                </div>
              </div>
            </div>
            
            {/* Close button */}
            <button
              onClick={stopScanning}
              className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full 
                       hover:bg-black/70 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <p className="text-center text-gray-600 mt-4">
            Position the barcode within the frame
          </p>
          
          <button
            onClick={captureAndScan}
            disabled={isLoading}
            className="w-full mt-4 bg-cigar-gold hover:bg-cigar-amber disabled:bg-gray-300 
                     text-cigar-dark font-semibold py-3 px-6 rounded-xl transition-colors
                     flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                Capture & Identify
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={startScanning}
            className="w-full bg-cigar-dark hover:bg-cigar-brown text-cigar-cream 
                     font-semibold py-4 px-6 rounded-xl transition-colors
                     flex items-center justify-center gap-3"
          >
            <Camera className="w-6 h-6" />
            Open Camera Scanner
          </button>

          {/* Upload option */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="w-full bg-white border-2 border-cigar-gold text-cigar-dark 
                     font-semibold py-4 px-6 rounded-xl transition-colors
                     hover:bg-cigar-cream flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Upload Photo
              </>
            )}
          </button>
        </div>
      )}

      {/* Manual Entry */}
      <div className="border-t border-gray-200 pt-6">
        <p className="text-sm text-gray-500 mb-3">Or enter barcode manually:</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
            placeholder="Enter barcode number..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 
                     focus:outline-none focus:ring-2 focus:ring-cigar-gold 
                     focus:border-transparent"
          />
          <button
            onClick={handleManualSearch}
            disabled={!manualBarcode.trim() || isLoading}
            className="bg-cigar-gold hover:bg-cigar-amber disabled:bg-gray-300 
                     text-cigar-dark p-3 rounded-xl transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}
    </div>
  )
}
