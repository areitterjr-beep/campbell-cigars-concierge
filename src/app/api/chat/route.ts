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

// Check if a cigar is in our inventory and get stock status
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

const SYSTEM_PROMPT = `You are an expert cigar concierge at Campbell Cigars. Be helpful, knowledgeable, and personable.

IMPORTANT CONTEXT: You are assisting customers who are ALREADY INSIDE Campbell Cigars shop. They are browsing in-store right now.
- NEVER suggest "visit a cigar shop" or "go to your local tobacconist" - they're already here!
- NEVER recommend buying online or from other retailers
- Instead, say things like "we have...", "I can show you...", "let me recommend...", "ask our staff to show you..."
- Treat recommendations as items they can see and purchase right now in the shop

You have extensive knowledge of ALL cigars worldwide - recommend the best cigars based on the customer's needs, not limited to any specific inventory.

RESPONSE FORMAT:
Always respond with valid JSON in this exact format:
{
  "message": "Your conversational response to the customer",
  "cigars": [] // Array of cigar objects when recommending, empty array otherwise
}

When recommending cigars, include detailed cigar objects:
{
  "message": "Your response here",
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
      "description": "2-3 sentence description",
      "tastingNotes": ["note1", "note2", "note3"],
      "pairings": {
        "alcoholic": ["drink1", "drink2"],
        "nonAlcoholic": ["drink1", "drink2"]
      }
    }
  ]
}

GUIDELINES:
1. Use good judgment on response length - be concise for simple questions, thorough when needed
2. Recommend 1-4 cigars based on context - use your expertise to pick the right number
3. Offer diverse recommendations across different brands, origins, and flavor profiles
4. Only recommend cigars when the customer is asking for recommendations - for educational/explanation questions, provide helpful information WITHOUT recommending cigars (empty cigars array)
5. Share your expertise freely about cigar culture, storage, terminology, etc.
6. Be conversational and welcoming - you're helping an in-store customer
7. For longer responses, use **bold** formatting for key terms, section headers, and important takeaways to make it easy to scan and read

EDUCATIONAL RESPONSES - When customers ask about cigar terminology (like "strength", "body", "flavor"), provide a CONCISE but COMPLETE explanation. Keep it brief enough to read WITHOUT scrolling. Use **bold** for key terms.

For "understand cigar strength, body and flavor":

**STRENGTH** = Nicotine intensity (NOT flavor!)
• Mild → Full: How much "kick" you feel physically
• Beginners: Start mild to avoid dizziness

**BODY** = Smoke weight on your palate  
• Light (skim milk) → Full (heavy cream)
• How thick/rich the smoke feels

**FLAVOR** = Actual taste notes
• Cedar, leather, pepper, chocolate, coffee, cream, nuts, spice
• Completely independent of strength!

**Key insight**: A mild cigar CAN have bold flavors and full body. Strength ≠ taste intensity!

**Quick guide**: New smokers - start mild STRENGTH, but enjoy any body/flavor you like.

End with a brief follow-up question.

IMPORTANT: Keep responses CONCISE - no more than 150 words for educational answers. Always output valid JSON. The "cigars" array MUST be empty [] for educational questions.`

const IMAGE_PROMPT = `You are a world-class cigar sommelier and expert identifier at Campbell Cigars shop. Your job is to identify cigars from photos, even in challenging conditions.

CONTEXT: You are helping customers who are IN THE SHOP right now. Never suggest visiting a cigar shop - they're already here!

ANALYZE EVERY DETAIL IN THE IMAGE:

1. CIGAR BAND (Primary Identifier):
   - Brand logo, text, symbols, emblems
   - Band colors and design patterns
   - Gold/silver accents, embossing
   - Secondary bands or foot bands
   - Band position and style

2. WRAPPER CHARACTERISTICS:
   - Color: Claro (light tan), Colorado Claro (medium brown), Colorado (reddish brown), Colorado Maduro (dark brown), Maduro (very dark), Oscuro (black)
   - Texture: Smooth, oily, veiny, toothy
   - Sheen: Matte, silky, oily
   
3. PHYSICAL CHARACTERISTICS:
   - Shape: Parejo (straight), Figurado (tapered), Torpedo, Belicoso, Perfecto, Churchill, Robusto, Corona, Lancero
   - Ring gauge (thickness) - estimate based on proportions
   - Length estimate
   - Cap style (triple cap = Cuban, pigtail, etc.)

4. CONTEXTUAL CLUES:
   - If someone is holding it, still identify the cigar - focus on visible portions
   - Humidor or packaging visible in background
   - Lighting or ash characteristics
   - Cellophane or tube visible

5. BRAND RECOGNITION:
   - Match band patterns to known brands even if text is partially obscured
   - Recognize iconic band designs (Cohiba's checkerboard, Montecristo's crossed swords, Padron's family crest, etc.)
   - Cuban brands often have "Habana" or "Hecho en Cuba"

CONFIDENCE SCORING (BE AGGRESSIVE):
- 80-100: Can identify brand and likely vitola from visible features
- 70-79: Brand clearly identifiable, vitola estimated from size/shape
- 60-69: Strong match based on band design/wrapper even if some details unclear
- 40-59: Can see cigar but need confirmation on specific details
- 0-39: Cannot see enough cigar details, image too unclear

IMPORTANT: If you can see ANY part of a cigar band or recognize wrapper/shape characteristics consistent with a known brand, provide your best identification with appropriate confidence. Don't be overly cautious - cigar enthusiasts want helpful identifications!

RESPONSE FORMAT - Always respond with valid JSON:
{
  "confidence": <number 0-100>,
  "message": "Your response",
  "cigars": []
}

IF CONFIDENCE >= 60: Identify the cigar:
{
  "confidence": 85,
  "message": "I can see this is a [cigar name]! [brief description of what you observed]",
  "cigars": [{
    "name": "Full cigar name",
    "brand": "Brand",
    "origin": "Country",
    "wrapper": "Wrapper type",
    "body": "Light/Medium/Full",
    "strength": "Mild/Medium/Full", 
    "price": "$X-$XX",
    "time": "XX-XXmin",
    "description": "Description of this cigar",
    "tastingNotes": ["note1", "note2", "note3"],
    "pairings": {"alcoholic": ["drink1"], "nonAlcoholic": ["drink1"]}
  }]
}

IF CONFIDENCE < 60: Ask ONE specific question:
{
  "confidence": 45,
  "message": "I can see [specific observations about wrapper, shape, partial band]. To confirm, can you tell me [ONE specific question]?",
  "cigars": []
}

Remember: Even partial views of cigars being held, smoked, or in cases can often be identified by an expert. Use your knowledge!`

// Helper to parse JSON from model response
function parseModelResponse(response: string): { message: string, cigars: CigarRecommendation[], confidence?: number } {
  try {
    // Try to find JSON in the response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        message: parsed.message || response,
        cigars: Array.isArray(parsed.cigars) ? parsed.cigars : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : undefined
      }
    }
  } catch (e) {
    console.log('Could not parse JSON, using response as message')
  }
  
  // If no valid JSON, return the response as message with no cigars
  return { message: response, cigars: [] }
}

// Parse image recognition response with confidence guardrail
function parseImageResponse(response: string): { message: string, cigars: CigarRecommendation[], confidence: number } {
  const parsed = parseModelResponse(response)
  const confidence = parsed.confidence ?? 50 // Default to 50 if not provided
  
  // Apply confidence guardrail - only show cigars if confidence >= 60
  if (confidence < 60) {
    console.log(`[Image] Low confidence (${confidence}%), asking for clarification`)
    return {
      message: parsed.message,
      cigars: [], // Don't show cigars if not confident
      confidence
    }
  }
  
  console.log(`[Image] Confidence: ${confidence}%`)
  return {
    message: parsed.message,
    cigars: parsed.cigars,
    confidence
  }
}

// Add inventory status to cigar recommendations
function enrichWithInventoryStatus(cigars: CigarRecommendation[]) {
  return cigars.map(cigar => {
    const status = getInventoryStatus(cigar.name)
    return {
      ...cigar,
      inStock: status.inStock,
      imageUrl: status.imageUrl
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const { messages, image, shownCigars = [] } = await request.json()
    const apiKey = process.env.GROQ_API_KEY
    const lastMessage = messages[messages.length - 1]?.content || ''
    
    if (!apiKey || apiKey === 'your_groq_api_key_here') {
      return NextResponse.json({
        message: "I'd be happy to help! What would you like to know about cigars?",
        cigars: []
      })
    }

    const groq = new Groq({ apiKey })

    // Handle image requests
    if (image) {
      try {
        // Import image utilities for compression
        const { resizeBase64Image, getImageSizeKB } = await import('@/lib/imageUtils')
        
        // Compress image if needed (Groq has size limits)
        const originalSize = getImageSizeKB(image)
        console.log(`[Chat] Original image size: ${originalSize}KB`)
        
        let processedImage = image
        if (originalSize > 500) {
          console.log('[Chat] Compressing large image...')
          processedImage = await resizeBase64Image(image, 1024, 1024, 75)
        }
        
        const base64Data = processedImage.split(',')[1]
        const mimeType = processedImage.split(';')[0].split(':')[1] || 'image/jpeg'
        
        // Use Scout as primary model (best accuracy based on testing)
        const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
        
        let response = ''
        let succeeded = false
        
        try {
          console.log(`[Chat] Using vision model: ${VISION_MODEL}`)
          const completion = await groq.chat.completions.create({
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: IMAGE_PROMPT + (lastMessage ? `\n\nCustomer says: ${lastMessage}` : '') },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } },
              ],
            }],
            model: VISION_MODEL,
            temperature: 0.7,
            max_tokens: 800,
          })
          
          response = completion.choices[0]?.message?.content || ''
          if (response) {
            console.log(`[Chat] Vision succeeded`)
            succeeded = true
          }
        } catch (modelError: any) {
          console.error(`[Chat] Vision model failed:`, modelError?.message || modelError)
          
          // If image is still too large, provide helpful error
          if (modelError?.message?.includes('413') || modelError?.message?.includes('too large')) {
            return NextResponse.json({
              message: "That image is too large for me to process. Could you try taking a closer photo of just the cigar band, or describe what you see on it?",
              cigars: [],
              confidence: 0
            })
          }
        }
        
        if (!succeeded || !response) {
          return NextResponse.json({
            message: "I'm having trouble analyzing that image. Could you tell me what text you see on the cigar band? Or describe the wrapper color?",
            cigars: [],
            confidence: 0
          })
        }

        // Use image-specific parser with confidence guardrail
        const parsed = parseImageResponse(response)
        return NextResponse.json({
          message: parsed.message,
          cigars: enrichWithInventoryStatus(parsed.cigars),
          confidence: parsed.confidence
        })
      } catch (visionError) {
        console.error('Vision error:', visionError)
        return NextResponse.json({
          message: "I couldn't process that image. Can you describe what you see on the cigar band?",
          cigars: []
        })
      }
    }

    // Build system prompt with context about previously shown cigars
    let systemPrompt = SYSTEM_PROMPT
    if (shownCigars.length > 0) {
      systemPrompt += `\n\n[Internal - do not mention to customer] Previously recommended cigars to avoid repeating: ${shownCigars.join(', ')}. Suggest different cigars for variety.`
    }

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 800,
    })

    const response = completion.choices[0]?.message?.content || ''
    const parsed = parseModelResponse(response)
    
    return NextResponse.json({
      message: parsed.message,
      cigars: enrichWithInventoryStatus(parsed.cigars)
    })
    
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({
      message: "Having trouble connecting. Try again!",
      cigars: []
    })
  }
}
