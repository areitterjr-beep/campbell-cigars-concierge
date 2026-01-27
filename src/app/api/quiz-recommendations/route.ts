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

// Check if a cigar is in our inventory
function getInventoryStatus(cigarName: string): { inStock: boolean, imageUrl?: string } {
  const found = cigarsData.cigars.find(c => 
    c.name.toLowerCase() === cigarName.toLowerCase() ||
    cigarName.toLowerCase().includes(c.name.toLowerCase()) ||
    c.name.toLowerCase().includes(cigarName.toLowerCase())
  )
  return {
    inStock: found ? found.inventory > 0 : false,
    imageUrl: found?.imageUrl || undefined
  }
}

const SYSTEM_PROMPT = `You are an expert cigar concierge at Campbell Cigars. A customer just completed a preference quiz.

Based on their preferences, recommend the best cigars from your extensive knowledge of ALL cigars worldwide.

RESPONSE FORMAT - Always respond with valid JSON:
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
- Recommend 2-4 cigars based on their experience level and preferences
- Beginners: 2-3 approachable options
- Experienced: 3-4 diverse options to compare
- Choose cigars that genuinely match their stated preferences
- Vary your recommendations across different brands and origins
- Be conversational in your intro message`

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

    const groq = new Groq({ apiKey })

    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
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
      
      // Add inventory status to each cigar
      const enrichedCigars = cigars.map(cigar => {
        const status = getInventoryStatus(cigar.name)
        return {
          ...cigar,
          inStock: status.inStock,
          imageUrl: status.imageUrl
        }
      })

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
