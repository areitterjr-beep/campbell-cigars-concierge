import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import cigarsData from '@/data/cigars.json'

interface CigarData {
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
  pairings: { alcoholic: string[], nonAlcoholic: string[] }
}

// Check if a cigar is in our inventory
function getInventoryData(cigarName: string): { imageUrl?: string, priceRange?: string } {
  const found = cigarsData.cigars.find(c => 
    c.name.toLowerCase() === cigarName.toLowerCase() ||
    cigarName.toLowerCase().includes(c.name.toLowerCase()) ||
    c.name.toLowerCase().includes(cigarName.toLowerCase())
  )
  return {
    imageUrl: found?.imageUrl || undefined,
    priceRange: (found as any)?.priceRange || undefined
  }
}

const SCAN_PROMPT = `You are a world-class cigar sommelier scanning a cigar to identify it. Be thorough and confident.

ANALYZE ALL VISIBLE FEATURES:

1. CIGAR BAND (Primary):
   - Brand logos, text, symbols (even partial)
   - Band colors, patterns, gold/silver accents
   - Iconic designs: Cohiba checkerboard, Montecristo swords, Padron crest, Davidoff white band, etc.
   - Secondary bands or foot bands

2. WRAPPER:
   - Claro (light tan), Colorado Claro (medium brown), Colorado (reddish), Colorado Maduro (dark brown), Maduro (very dark), Oscuro (black)
   - Texture: smooth, oily, veiny, toothy
   - Sheen and quality indicators

3. SHAPE & SIZE:
   - Parejo, Torpedo, Belicoso, Perfecto, Churchill, Robusto, Corona, Lancero
   - Ring gauge estimate, length estimate
   - Cap style (triple cap = Cuban)

4. CONTEXT:
   - Works even if someone is HOLDING the cigar - focus on visible parts
   - Cellophane, tubes, humidor background
   - Partial views are still identifiable

5. BRAND MATCHING:
   - Match band patterns even with partial text
   - Cuban: look for "Habana", "Hecho en Cuba"
   - Dominican, Nicaraguan, Honduran indicators

CONFIDENCE (BE AGGRESSIVE - experts can identify from partial views):
- 80-100: Brand and vitola identifiable
- 70-79: Brand clear, vitola estimated
- 60-69: Strong match from band/wrapper patterns
- 40-59: Need one clarifying detail
- 0-39: Cannot see enough of the cigar

RESPONSE FORMAT - Always valid JSON:
{
  "confidence": <number 0-100>,
  "identified": <boolean>,
  "cigar": {...} or null,
  "message": "Your response"
}

IF CONFIDENCE >= 60:
{
  "confidence": 85,
  "identified": true,
  "cigar": {
    "name": "Full cigar name",
    "brand": "Brand name",
    "origin": "Country of origin",
    "wrapper": "Wrapper type",
    "body": "Light/Medium/Full",
    "strength": "Mild/Medium/Full",
    "price": "$X-$XX estimated",
    "time": "XX-XXmin",
    "description": "2-3 sentence description",
    "tastingNotes": ["note1", "note2", "note3", "note4"],
    "pairings": {
      "alcoholic": ["drink1", "drink2"],
      "nonAlcoholic": ["drink1", "drink2"]
    }
  },
  "message": "I identified this as [name]. [What you observed that led to ID]"
}

IF CONFIDENCE < 60:
{
  "confidence": 45,
  "identified": false,
  "cigar": null,
  "message": "I can see [specific observations]. Can you [ONE specific question]?"
}

Remember: Even cigars being held, partially visible, or in challenging lighting can often be identified by wrapper color, band design, and shape!

REFERENCE IMAGES (when provided): You will receive reference images from our store inventory. Compare the customer's photo to these—match band design, colors, text, and appearance. Use them as visual training. Prefer matching to a reference when the photo clearly matches one.`

export async function POST(request: NextRequest) {
  try {
    const { barcode, image } = await request.json()

    // If a barcode was provided directly, look it up in inventory
    if (barcode) {
      const cigar = cigarsData.cigars.find((c) => (c as any).barcode === barcode)
      
      if (cigar) {
        return NextResponse.json({ cigar })
      }
      
      // Try partial match or name search
      const partialMatch = cigarsData.cigars.find((c) => 
        (c as any).barcode?.includes(barcode) || 
        c.name.toLowerCase().includes(barcode.toLowerCase()) ||
        c.brand.toLowerCase().includes(barcode.toLowerCase())
      )
      
      if (partialMatch) {
        return NextResponse.json({ cigar: partialMatch })
      }
      
      return NextResponse.json({ 
        error: 'Cigar not found. Try searching by brand or name, or ask our AI assistant for help!' 
      })
    }

    // If an image was provided, use AI to identify it
    if (image) {
      const apiKey = process.env.GROQ_API_KEY
      
      if (!apiKey || apiKey === 'your_groq_api_key_here') {
        return NextResponse.json({
          error: 'Image recognition requires API configuration. Please use our chat assistant for help!'
        })
      }

      const groq = new Groq({ apiKey })

      try {
        // Import image utilities for compression
        const { resizeBase64Image, getImageSizeKB } = await import('@/lib/imageUtils')
        
        // Compress image if needed (Groq has size limits)
        const originalSize = getImageSizeKB(image)
        console.log(`[Scan] Original image size: ${originalSize}KB`)
        
        let processedImage = image
        if (originalSize > 500) {
          console.log('[Scan] Compressing large image...')
          processedImage = await resizeBase64Image(image, 1024, 1024, 75)
        }
        
        const base64Data = processedImage.split(',')[1]
        const mimeType = processedImage.split(';')[0].split(':')[1] || 'image/jpeg'

        // Fetch reference images from inventory for better recognition
        const { getReferenceImagesFromInventory } = await import('@/lib/imageUtils')
        const referenceImages = await getReferenceImagesFromInventory(
          cigarsData.cigars as any[],
          6
        )
        const refPrompt = referenceImages.length > 0
          ? `\n\nREFERENCE IMAGES: Below are ${referenceImages.length} product photos from our inventory. Compare the CUSTOMER'S PHOTO (the last image) to these:\n${referenceImages
              .map((r, i) => `${i + 1}. ${r.brand} - ${r.name}`)
              .join('\n')}\n\nThe LAST image is the customer's cigar photo to identify.`
          : ''

        // Use Scout as primary model (best accuracy based on testing)
        const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
        
        let response = ''
        let succeeded = false
        
        const visionPrompt = SCAN_PROMPT + refPrompt
        const contentParts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
          { type: 'text', text: visionPrompt },
        ]
        for (const ref of referenceImages) {
          contentParts.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${ref.base64}` } })
        }
        contentParts.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } })
        
        try {
          console.log(`[Scan] Using vision model: ${VISION_MODEL} (${referenceImages.length} references)`)
          const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: contentParts }],
            model: VISION_MODEL,
            temperature: 0.3,
            max_tokens: 800,
          })
          
          response = completion.choices[0]?.message?.content?.trim() || ''
          if (response) {
            console.log(`[Scan] Vision succeeded`)
            succeeded = true
          }
        } catch (modelError: any) {
          console.error(`[Scan] Vision model failed:`, modelError?.message || modelError)
          
          // If image is still too large, provide helpful error
          if (modelError?.message?.includes('413') || modelError?.message?.includes('too large')) {
            return NextResponse.json({
              error: 'That image is too large. Try taking a closer photo of just the cigar band!',
              confidence: 0
            })
          }
        }
        
        if (!succeeded || !response) {
          return NextResponse.json({
            error: 'Could not analyze the image. Try taking a clearer photo of the cigar band!',
          })
        }

        // Parse JSON response with confidence guardrail
        try {
          const jsonMatch = response.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            const confidence = parsed.confidence ?? 50
            
            console.log(`[Scan] Confidence: ${confidence}%`)
            
            // Apply confidence guardrail - only return cigar if confidence >= 60
            if (confidence >= 60 && parsed.identified && parsed.cigar) {
              const data = getInventoryData(parsed.cigar.name)
              return NextResponse.json({ 
                cigar: {
                  ...parsed.cigar,
                  id: `ai-${Date.now()}`,
                  barcode: '',
                  bestFor: [],
                  imageUrl: data.imageUrl,
                  price: data.priceRange || parsed.cigar.price
                },
                confidence
              })
            } else if (parsed.message) {
              // Low confidence or not identified - return the clarifying message
              return NextResponse.json({ 
                error: parsed.message,
                confidence,
                needsClarification: confidence < 60
              })
            }
          }
        } catch (parseError) {
          console.error('[Scan] JSON parse error:', parseError)
        }
        
        return NextResponse.json({
          error: 'Could not identify this cigar. Try taking a clearer photo of the band, or use our chat assistant for help!',
          confidence: 0
        })

      } catch (visionError) {
        console.error('[Scan] Vision API error:', visionError)
        return NextResponse.json({
          error: 'Could not analyze the image. Try our chat assistant instead!',
        })
      }
    }

    return NextResponse.json({ error: 'Please provide a barcode or image' })
  } catch (error) {
    console.error('[Scan] API error:', error)
    return NextResponse.json(
      { error: 'Failed to process scan request' },
      { status: 500 }
    )
  }
}
