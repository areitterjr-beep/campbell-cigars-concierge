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
}

// Check if a cigar is in our inventory and get its data
function getInventoryData(cigarName: string, brandName?: string): { inInventory: boolean; imageUrl?: string; priceRange?: string } {
  const queryName = cigarName.toLowerCase().trim()
  const queryBrand = (brandName || '').toLowerCase().trim()
  const cFull = queryBrand ? `${queryBrand} ${queryName}` : queryName
  const found = (cigarsData.cigars as any[]).find(c => {
    const cName = c.name.toLowerCase()
    const cBrand = c.brand.toLowerCase()
    const invFull = `${cBrand} ${cName}`
    // Exact match
    if (cName === queryName && (!queryBrand || cBrand === queryBrand)) return true
    if (invFull === cFull || invFull === queryName) return true
    // Substring match (AI may include brand in name or use shorthand)
    if (invFull.includes(queryName) || queryName.includes(cName)) return true
    if (queryBrand && cBrand.includes(queryBrand) && (cName.includes(queryName) || queryName.includes(cName))) return true
    return false
  })
  return {
    inInventory: !!found,
    imageUrl: found?.imageUrl || undefined,
    priceRange: found?.priceRange || undefined
  }
}

const SYSTEM_PROMPT = `You are an expert cigar concierge at Campbell Cigars. A customer just completed a preference quiz.

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
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          message = parsed.message || message
          cigars = Array.isArray(parsed.cigars) ? parsed.cigars : []
        }
      } catch {
        console.log('Could not parse quiz recommendations JSON')
      }
      
      // Filter to only cigars in inventory, add inventory data, limit to 2 (like chat)
      const enrichedCigars = cigars
        .map(cigar => {
          const data = getInventoryData(cigar.name, cigar.brand)
          if (!data.inInventory) return null
          return {
            ...cigar,
            imageUrl: data.imageUrl,
            price: data.priceRange || cigar.price
          }
        })
        .filter((c): c is CigarRecommendation => c !== null)
        .slice(0, 2)

      return NextResponse.json({
        message,
        cigars: enrichedCigars
      })
    } catch (aiError) {
      console.error('AI error:', aiError)
      return NextResponse.json({
        message: "I'd be happy to help you find the perfect cigar! Try our chat assistant for personalized recommendations.",
        cigars: []
      })
    }
    
  } catch (error) {
    console.error('Quiz recommendations error:', error)
    return NextResponse.json({
      message: "Something went wrong. Please try our chat assistant!",
      cigars: []
    })
  }
}
