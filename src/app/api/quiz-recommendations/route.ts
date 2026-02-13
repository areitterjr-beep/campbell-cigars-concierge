import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import cigarsData from '@/data/cigars.json'

interface CigarRecommendation {
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
  imageUrl?: string
  productUrl?: string
}

// Tokenize a string into meaningful words for matching
function tokenize(s: string): string[] {
  return s.toLowerCase()
    .replace(/['']/g, '')
    .split(/[\s\-–—\/.,;:()]+/)
    .filter(w => w.length > 0)
}

// Words too generic to be useful for matching on their own
const NOISE_WORDS = new Set([
  'the', 'de', 'del', 'la', 'las', 'los', 'and', 'by', 'of', 'no', 'a', 'el',
  'cigar', 'cigars', 'toro', 'robusto', 'churchill', 'corona', 'gordo', 'lancero',
  'belicoso', 'torpedo', 'perfecto', 'petit', 'double', 'gran', 'grande'
])

// Robust inventory match — same logic as chat route
function findInventoryMatch(cigarName: string, brandName?: string): any | null {
  const queryName = cigarName.toLowerCase().trim()
  const queryBrand = brandName?.toLowerCase().trim() || ''

  const nameTokens = tokenize(queryName)
  const brandTokens = tokenize(queryBrand)

  const deduped = nameTokens.filter(t => !brandTokens.includes(t))
  const allQueryTokens = [...brandTokens, ...deduped]

  let bestMatch: any = null
  let bestScore = 0

  for (const c of cigarsData.cigars as any[]) {
    const cName = c.name.toLowerCase()
    const cBrand = c.brand.toLowerCase()

    const cFull = `${cBrand} ${cName}`
    const qFull = queryBrand ? `${queryBrand} ${queryName}` : queryName

    if (cFull === qFull || cName === queryName) {
      if (100 > bestScore) { bestScore = 100; bestMatch = c }
      continue
    }
    if (cFull === queryName || qFull === cFull) {
      if (98 > bestScore) { bestScore = 98; bestMatch = c }
      continue
    }

    const cBrandTokens = tokenize(cBrand)
    const cNameTokens = tokenize(cName)
    const cAllTokens = [...cBrandTokens, ...cNameTokens]

    const brandMatch = queryBrand && (
      cBrand === queryBrand ||
      cBrand.includes(queryBrand) || queryBrand.includes(cBrand) ||
      cBrandTokens.some(bt => brandTokens.includes(bt))
    )

    let matchCount = 0
    let matchWeight = 0
    const matched: string[] = []

    for (const qt of allQueryTokens) {
      if (NOISE_WORDS.has(qt)) continue
      for (const ct of cAllTokens) {
        if (qt === ct) {
          matchCount++
          const isNumber = /^\d+$/.test(qt)
          const isDistinctive = qt.length >= 6
          matchWeight += isNumber ? 30 : isDistinctive ? 20 : 10
          matched.push(qt)
          break
        }
      }
    }

    const nonBrandMatches = matched.filter(m => !brandTokens.includes(m))

    let score = 0
    if (brandMatch && nonBrandMatches.length >= 1) {
      score = 20 + matchWeight
    } else if (nonBrandMatches.length >= 2) {
      score = 10 + matchWeight
    }

    if (score > 0 && (queryName.includes(cName) || cName.includes(queryName))) {
      score += 15
    }
    if (score > 0 && (qFull.includes(cFull) || cFull.includes(qFull))) {
      score += 10
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = c
    }
  }

  return bestScore >= 25 ? bestMatch : null
}

// Enrich AI-returned cigars with authoritative inventory data
function enrichWithInventoryData(cigars: CigarRecommendation[]): CigarRecommendation[] {
  return cigars.map(cigar => {
    const inv = findInventoryMatch(cigar.name, cigar.brand)
    if (!inv) return cigar

    return {
      name: `${inv.brand} ${inv.name}`,
      brand: inv.brand,
      origin: inv.origin || cigar.origin,
      wrapper: inv.wrapper || cigar.wrapper,
      body: inv.body || cigar.body,
      strength: inv.strength || cigar.strength,
      price: inv.priceRange || cigar.price,
      time: inv.smokingTime || cigar.time,
      description: inv.description || cigar.description,
      tastingNotes: Array.isArray(inv.tastingNotes) && inv.tastingNotes.length > 0
        ? inv.tastingNotes
        : cigar.tastingNotes,
      pairings: inv.pairings && (inv.pairings.alcoholic?.length || inv.pairings.nonAlcoholic?.length)
        ? inv.pairings
        : cigar.pairings,
      productUrl: inv.productUrl || undefined,
      imageUrl: inv.imageUrl || undefined,
    }
  })
}

const SYSTEM_PROMPT = `You are an expert cigar advisor for Campbell Cigars. A customer just completed a preference quiz and you are helping them make an informed purchasing decision.

CRITICAL - INVENTORY ONLY: You may ONLY recommend cigars that appear in the store's inventory list provided below. Never suggest cigars that are not in this list. Recommend the closest match from the list based on the customer's preferences.

RESPONSE FORMAT - Always respond with valid JSON. Include EXACTLY 2 cigars in the array:
{
  "message": "Brief, warm 1-2 sentence intro referencing their preferences",
  "cigars": [
    {
      "name": "Full cigar name",
      "brand": "Brand name",
      "origin": "Country",
      "wrapper": "Wrapper type",
      "body": "Light/Medium/Full",
      "strength": "Mild/Medium/Full",
      "price": "$X-$XX",
      "time": "XX-XXmin",
      "description": "2-3 sentence description explaining why this matches their preferences",
      "tastingNotes": ["note1", "note2", "note3", "note4"],
      "pairings": {
        "alcoholic": ["drink1", "drink2"],
        "nonAlcoholic": ["drink1", "drink2"]
      }
    }
  ]
}

GUIDELINES:
- Recommend EXACTLY 2 cigars based on their experience level and preferences
- Choose cigars that genuinely match their stated preferences
- Vary your recommendations across different brands and origins
- Be conversational in your intro message
- You MUST use the EXACT "brand" and "name" from the inventory list for each cigar you recommend`

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { preferences } = await request.json()
    const apiKey = process.env.GROQ_API_KEY
    
    if (!apiKey || apiKey === 'your_groq_api_key_here') {
      return NextResponse.json({
        message: "Based on your preferences, here are my top picks for you!",
        cigars: []
      })
    }

    const inventoryList = (cigarsData.cigars as any[])
      .map((c) => `${c.brand} - ${c.name}`)
      .join('\n')
    const systemPrompt = SYSTEM_PROMPT + `\n\nSTORE INVENTORY (you may ONLY recommend from this list):\n${inventoryList}`

    const groq = new Groq({ apiKey })

    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Customer quiz preferences:\n${preferences}` 
          },
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 1500,
      })

      const responseText = completion.choices[0]?.message?.content || ''
      
      // Parse the JSON response
      let message = "Based on your preferences, here are my top picks for you!"
      let cigars: CigarRecommendation[] = []
      
      try {
        // Strip markdown code fences if present
        const cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '')
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          message = parsed.message || message
          cigars = Array.isArray(parsed.cigars) ? parsed.cigars : []
        }
      } catch {
        console.log('[Quiz] Could not parse recommendations JSON, raw:', responseText.substring(0, 200))
      }
      
      // Enrich with authoritative inventory data (images, correct prices, etc.)
      const enrichedCigars = enrichWithInventoryData(cigars).slice(0, 2)

      console.log(`[Quiz] Recommendations: ${enrichedCigars.map(c => c.name).join(', ')}`)

      return NextResponse.json({
        message,
        cigars: enrichedCigars
      })
    } catch (aiError) {
      console.error('[Quiz] AI error:', aiError)
      return NextResponse.json({
        message: "I'd be happy to help you find the perfect cigar! Try the chat assistant for personalized recommendations.",
        cigars: []
      })
    }
    
  } catch (error) {
    console.error('[Quiz] Recommendations error:', error)
    return NextResponse.json({
      message: "Something went wrong. Please try the chat assistant!",
      cigars: []
    })
  }
}
