import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
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

// Match a cigar against our inventory and return the full inventory record (or null)
function findInventoryMatch(cigarName: string, brandName?: string): any | null {
  const queryName = cigarName.toLowerCase().trim()
  const queryBrand = brandName?.toLowerCase().trim() || ''

  // Build query tokens from what the AI returned
  const nameTokens = tokenize(queryName)
  const brandTokens = tokenize(queryBrand)

  // Remove brand tokens that appear in name (AI often puts brand in the name too)
  const deduped = nameTokens.filter(t => !brandTokens.includes(t))
  const allQueryTokens = [...brandTokens, ...deduped]

  let bestMatch: any = null
  let bestScore = 0

  for (const c of cigarsData.cigars as any[]) {
    const cName = c.name.toLowerCase()
    const cBrand = c.brand.toLowerCase()

    // === Exact / near-exact matches (highest priority) ===
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

    // === Token-based fuzzy matching ===
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

// Legacy wrapper used by existing callers
function getInventoryStatus(cigarName: string, brandName?: string): { productUrl?: string, imageUrl?: string, priceRange?: string } {
  const match = findInventoryMatch(cigarName, brandName)
  return {
    productUrl: match?.productUrl || undefined,
    imageUrl: match?.imageUrl || undefined,
    priceRange: match?.priceRange || undefined
  }
}

// Extract cigar name from image identification message (e.g. "I can see this is a My Father Blue!")
function findCigarFromImageMessage(message: string): CigarRecommendation | null {
  const idPatterns = [
    /(?:I can (?:clearly )?see|this is) (?:this is |it's )?(?:a |an )?(.+?)(?:!|\.|,|$)/i,
    /(?:clearly |easily )?(?:identify|recognize) (?:this as|it as) (?:a |an )?(.+?)(?:!|\.|,|$)/i,
    /(?:ah,?|oh,?)?\s*(?:I can clearly see )?this is (?:a |an )?(.+?)(?:!|\.|,|$)/i,
  ]
  let query = ''
  for (const p of idPatterns) {
    const m = message.match(p)
    if (m && m[1]) {
      query = m[1].trim().replace(/^"(.*)"$/, '$1')
      break
    }
  }
  if (!query || tokenize(query).filter(t => !NOISE_WORDS.has(t)).length < 1) return null
  return findCigarFromUserMessage(`tell me about ${query}`)
}

// Find a cigar in inventory when user asks for a specific cigar by name
function findCigarFromUserMessage(userMessage: string): CigarRecommendation | null {
  const msg = userMessage.toLowerCase().trim()
  const msgTokens = tokenize(msg)
  if (msgTokens.length < 2) return null // Need at least something like "padron 1964"

  // Phrases that indicate user is asking for a specific cigar
  const askPatterns = [
    /tell\s+me\s+(?:about|more\s+about)\s+(?:the\s+)?(.+)/i,
    /what(?:'s|\s+is)\s+(?:the\s+)?(.+?)\s+like\?/i,
    /what\s+about\s+(?:the\s+)?(.+?)(?:\?|$)/i,
    /(?:want\s+to\s+know|know\s+more)\s+about\s+(?:the\s+)?(.+)/i,
    /do\s+you\s+have\s+(?:the\s+)?(.+?)(?:\?|$)/i,
    /(?:show\s+me|get\s+me)\s+(?:the\s+)?(.+)/i,
    /tell\s+me\s+about\s+(.+)/i,
  ]

  let query = msg
  for (const p of askPatterns) {
    const m = msg.match(p)
    if (m && m[1]) {
      query = m[1].trim()
      break
    }
  }

  const queryTokens = tokenize(query).filter((t) => !NOISE_WORDS.has(t))
  if (queryTokens.length < 1) return null

  let bestMatch: any = null
  let bestScore = 0

  for (const c of cigarsData.cigars as any[]) {
    const cName = c.name.toLowerCase()
    const cBrand = c.brand.toLowerCase()
    const cFull = `${cBrand} ${cName}`
    const cTokens = tokenize(cFull)
    const cBrandTokens = tokenize(cBrand)

    let matchCount = 0
    let matchWeight = 0
    for (const qt of queryTokens) {
      if (NOISE_WORDS.has(qt)) continue
      for (const ct of cTokens) {
        if (qt === ct) {
          matchCount++
          const isNumber = /^\d+$/.test(qt)
          const isDistinctive = qt.length >= 5
          matchWeight += isNumber ? 30 : isDistinctive ? 20 : 10
          break
        }
      }
    }

    const brandInQuery = cBrandTokens.some((bt: string) => queryTokens.includes(bt))
    const score = brandInQuery ? 15 + matchWeight : matchWeight
    if (matchCount >= 1 && score > bestScore && score >= 25) {
      bestScore = score
      bestMatch = c
    }
  }

  if (!bestMatch) return null

  return {
    name: bestMatch.name,
    brand: bestMatch.brand,
    origin: bestMatch.origin || '',
    wrapper: bestMatch.wrapper || '',
    body: bestMatch.body || 'Medium',
    strength: bestMatch.strength || 'Medium',
    price: bestMatch.priceRange || '$0',
    time: bestMatch.smokingTime || '45-60min',
    description: bestMatch.description || '',
    tastingNotes: Array.isArray(bestMatch.tastingNotes) ? bestMatch.tastingNotes : [],
    pairings: bestMatch.pairings || { alcoholic: [], nonAlcoholic: [] },
  }
}

const SYSTEM_PROMPT = `You are an expert cigar concierge at Campbell Cigars. Be helpful, knowledgeable, and personable.

IMPORTANT CONTEXT: You are assisting customers who are ALREADY INSIDE Campbell Cigars shop. They are browsing in-store right now.
- NEVER suggest "visit a cigar shop" or "go to your local tobacconist" - they're already here!
- NEVER recommend buying online or from other retailers
- Instead, say things like "we have...", "I can show you...", "let me recommend...", "ask our staff to show you..."
- Treat recommendations as items they can see and purchase right now in the shop

CRITICAL - INVENTORY ONLY: You may ONLY recommend cigars that appear in the store's inventory list provided below. Never suggest cigars that are not in this list—unless the customer specifically requests a cigar by name (e.g., "Tell me about My Father No. 4" or "I want the Padron 1964"). In that case only, you may discuss the requested cigar even if it's not in inventory. For any other request, recommend the closest match from the list.

RESPONSE FORMAT:
Always respond with valid JSON in this exact format:
{
  "message": "Your conversational response to the customer",
  "cigars": [] // Array of cigar objects when recommending, empty array otherwise
}

When recommending cigars, include EXACTLY 2 cigar objects (no more, no less):
{
  "message": "Your response mentioning only CigarA and CigarB",
  "cigars": [
    {
      "name": "CigarA full name",
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
    },
    {
      "name": "CigarB full name",
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
2. CRITICAL: When recommending cigars, ALWAYS recommend EXACTLY 2 cigars. The "cigars" array must contain exactly 2 objects. Your "message" text must ONLY mention these same 2 cigars by name - never reference any other cigars that are not in the array. EXCEPTION: When the customer asks for a SPECIFIC cigar by name (e.g. "Tell me about the Padron 1964", "What's the Opus X like?"), include that cigar in the cigars array (1 cigar) so we can display its card.
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

QUICK QUESTIONS - Owner's preferred answers (use these when customers ask):
1. "What are cigars all about?" → Cigars are about enjoying a handcrafted tobacco product for flavor, aroma, and relaxation—slowly and intentionally—often as a way to unwind, celebrate, or socialize.
2. "What does strength mean?" → Strength refers to how powerful a cigar's flavor is, mainly based on its content and overall intensity.
3. "What affects cigar price and quality?" → Tobacco quality, aging time, craftsmanship, construction, brand, and rarity.
4. "What are celebration cigars?" → Special aged, well-branded cigars enjoyed to mark important moments like milestones, achievements, or special occasions.
5. "Light/medium/full-bodied suggestions?" → Recommend 2 cigars from our inventory spanning light, medium, and full body. Use the cigars array.
6. "Tell me about this cigar" → If they have a photo: use image ID. If they name a cigar: describe it from inventory AND include that cigar in the cigars array (1 cigar) so we can display its card. If unclear: ask which cigar they mean.
7. "How are cigars evaluated?" → Appearance, construction, draw, burn, flavor, aroma, and balance.
8. "Mold vs plume (bloom)?" → Mold is harmful and fuzzy; plume (bloom) is harmless white dust from natural oils aging on the cigar.
9. "Ideal storage temp and humidity?" → About 65–70% humidity and 65–70°F (18–21°C).

IMPORTANT: Keep responses CONCISE - no more than 150 words for educational answers. Always output valid JSON. The "cigars" array MUST be empty [] for educational questions.`

const IMAGE_PROMPT = `You are a world-class cigar sommelier and expert identifier at Campbell Cigars shop. Your job is to identify cigars from photos with high accuracy.

CONTEXT: You are helping customers who are IN THE SHOP right now. Never suggest visiting a cigar shop - they're already here!

CRITICAL: READ THE BAND TEXT CAREFULLY!
The cigar band is your PRIMARY identification tool. Text like "BLUE" vs "LE BIJOU 1922" are different cigars—never guess. Look for:
- ANY text/words on the band (brand name, line name, country)
- Numbers (like "1926", "1964", "No. 9")
- Letters or initials

ICONIC BAND IDENTIFICATION GUIDE:

**PADRON**: 
- Family crest with "PADRON" text, often gold on dark band
- 1926 Anniversary: "1926" prominently displayed, black/gold band
- 1964 Anniversary: "1964" prominently displayed
- Natural vs Maduro indicated on band

**ARTURO FUENTE**:
- Ornate bands with "A. FUENTE" or "ARTURO FUENTE"
- OpusX: Red/gold band with "FUENTE FUENTE OPUSX"
- Hemingway: Green band with signature
- Don Carlos: Gold/black with portrait

**MY FATHER** - CRITICAL: Band COLOR and TEXT distinguish these. Do NOT confuse them.
- Blue: Blue + WHITE (like paper/cream). Band says "BLUE". White = Blue only.
- Le Bijou: Blue + SILVER (metallic gray). Band says "LE BIJOU 1922". Silver = Le Bijou only.
- RULE: White secondary color + "BLUE" text = My Father Blue. Silver/gray secondary + "LE BIJOU" = Le Bijou. If unsure which, READ THE BAND TEXT.
- Flor de Las Antillas: Red/gold ornate band

**OLIVA**:
- "OLIVA" text prominently displayed
- Serie V: Red "V" on black band
- Serie G: Green band with "G"

**LIGA PRIVADA**:
- "LIGA PRIVADA" text, pig logo
- No. 9: "No. 9" on band
- T52: "T52" on band
- Drew Estate branding

**ROCKY PATEL**:
- "ROCKY PATEL" text on band
- Decade: "DECADE" text
- Vintage series: Year displayed (1990, 1992, 1999, 2003)

**COHIBA** (Cuban):
- Yellow/white checkerboard pattern
- Black "COHIBA" text
- Taino Indian head silhouette

**MONTECRISTO**:
- Crossed swords with "M" monogram
- Fleur-de-lis design
- "MONTECRISTO" text

**DAVIDOFF**:
- Clean, elegant white band
- "DAVIDOFF" in simple font
- Often minimal design

**ASHTON**:
- "ASHTON" text, often with lion
- VSG: "VIRGIN SUN GROWN" text, green/gold band
- ESG: Blue band

**PERDOMO**:
- "PERDOMO" text prominently
- Lot 23, Champagne, Reserve lines indicated

**CAO**:
- "CAO" letters prominently displayed
- Various colorful bands by line

WRAPPER COLOR IDENTIFICATION:
- Natural/Connecticut: Light tan to golden (lighter = Connecticut Shade)
- Habano/Corojo: Medium brown with reddish hue
- Maduro: Dark brown to almost black, often oily
- Oscuro: Very dark, nearly black

PHYSICAL SIZE CLUES:
- Robusto: 5" x 50 (shorter, thicker)
- Toro: 6" x 50-52 (medium length, thick)
- Churchill: 7" x 48 (long, elegant)
- Corona: 5.5" x 42 (thinner, classic)
- Gordo/60 ring: Very thick cigars

CONFIDENCE SCORING (BE CONSERVATIVE):
- 80-100: Can read brand name and/or recognize iconic band clearly, matches a reference image
- 75-79: Brand pattern matches known design, text clearly visible, strong match to inventory
- 40-74: Uncertain - band partially visible, or cannot match to reference/inventory. ASK FOR CLARIFICATION.
- 0-39: Cannot make out band details

CRITICAL: When in doubt, use confidence < 75 and ask ONE specific clarifying question. Only identify when you can clearly match the band to a cigar in our store inventory. Do NOT guess.

RESPONSE FORMAT - Valid JSON only. Keep message under 50 words. No confidence in message.
{
  "confidence": <number 0-100>,
  "message": "Your response",
  "cigars": []
}

IF CONFIDENCE >= 75: Identify the cigar:
{
  "confidence": 85,
  "message": "I can see this is a [cigar name]!",
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

IF CONFIDENCE < 75: Ask ONE specific question:
{
  "confidence": 45,
  "message": "I can see [specific observations about wrapper, shape, partial band]. To confirm, can you tell me [ONE specific question]?",
  "cigars": []
}

REFERENCE IMAGES (when provided): You will receive reference images from our store inventory. Compare the customer's photo to these—match band design, colors, and text. Only identify when you have a clear visual match to a reference or to a cigar in the inventory list below.

CRITICAL - My Father Blue vs Le Bijou: Different colors, different text. Blue = blue+WHITE band, word "BLUE" on band. Le Bijou = blue+SILVER band, "LE BIJOU 1922" on band. WHITE≠SILVER. "BLUE"≠"LE BIJOU". Before identifying, verify: if band is white/cream colored → Blue. If band has silver/metallic gray → Le Bijou.

STORE INVENTORY (you may ONLY identify cigars from this list—if the band does not clearly match one of these, use confidence < 75 and ask for clarification):`

// Helper to parse JSON from model response (handles truncated responses)
function parseModelResponse(response: string): { message: string, cigars: CigarRecommendation[], confidence?: number } {
  // Strip markdown code fences the model sometimes wraps around JSON
  const cleaned = response.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()

  try {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        message: parsed.message || '',
        cigars: Array.isArray(parsed.cigars) ? parsed.cigars : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : undefined
      }
    }
  } catch (_) { /* fall through to regex extraction */ }

  // Regex extraction for truncated / malformed JSON
  const confMatch = cleaned.match(/"confidence"\s*:\s*(\d+)/)
  const msgMatch = cleaned.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/)
  const cigarNameMatch = cleaned.match(/"cigars"\s*:\s*\[\s*\{\s*"name"\s*:\s*"((?:[^"\\]|\\.)*)/)
  const msg = msgMatch ? msgMatch[1].replace(/\\"/g, '"') : ''
  const conf = confMatch ? parseInt(confMatch[1], 10) : undefined
  let cigars: CigarRecommendation[] = []
  if (cigarNameMatch) {
    const name = cigarNameMatch[1].replace(/\\"/g, '"').trim()
    const backfill = findCigarFromUserMessage(`tell me about ${name}`)
    if (backfill) cigars = [backfill]
  }
  return { message: msg, cigars, confidence: conf }
}

// Strip confidence numbers from message so users only see conversational text
function sanitizeMessage(message: string): string {
  let out = message
    .replace(/^"\s*message\s*"\s*:\s*"/i, '')
    .replace(/\s*[\[\({]?\s*"?confidence"?\s*:\s*\d+\s*%?[\]\)}]?/gi, '')
    .replace(/\bconfidence\s*:\s*\d+\s*%?\.?/gi, '')
    .replace(/\s*Confidence:\s*\d+%?\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
  out = out.replace(/\\"/g, '"').trim()
  if (out.endsWith('"') && !out.startsWith('"')) out = out.slice(0, -1)
  return out
}

// Parse image recognition response with confidence guardrail
function parseImageResponse(response: string): { message: string, cigars: CigarRecommendation[], confidence: number } {
  const parsed = parseModelResponse(response)
  let confidence = parsed.confidence ?? 50
  const message = sanitizeMessage(parsed.message)
  let cigars = parsed.cigars

  if (cigars.length === 0) {
    const backfill = findCigarFromImageMessage(parsed.message)
    if (backfill) {
      cigars = [backfill]
      if (confidence < 75) confidence = 80
    }
  }

  if (confidence < 75 && cigars.length === 0) {
    console.log(`[Image] Low confidence (${confidence}%), asking for clarification`)
    return { message, cigars: [], confidence }
  }

  console.log(`[Image] Confidence: ${confidence}%`)
  return { message, cigars, confidence }
}

// Replace AI-generated card data with authoritative inventory data so the
// same cigar always shows consistent values regardless of model output.
function enrichWithInventoryData(cigars: CigarRecommendation[]): (CigarRecommendation & { productUrl?: string; imageUrl?: string })[] {
  return cigars.map(cigar => {
    const inv = findInventoryMatch(cigar.name, cigar.brand)
    if (!inv) return { ...cigar, productUrl: undefined, imageUrl: undefined }

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

// Keep only cigars that match our inventory (reject wrong IDs / cigars we don't carry)
function filterCigarsByInventory<T extends { productUrl?: string; imageUrl?: string }>(enriched: T[]): T[] {
  return enriched.filter(c => !!(c.productUrl || c.imageUrl))
}

// Allow up to 30s for AI API calls (Groq/Gemini can be slow)
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { messages, image, shownCigars = [] } = await request.json()
    const groqKey = process.env.GROQ_API_KEY
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    const hasGroq = groqKey && groqKey !== 'your_groq_api_key_here'
    const hasGemini = geminiKey && geminiKey !== 'your_gemini_api_key_here'
    const lastMessage = messages[messages.length - 1]?.content || ''
    
    if (!hasGroq && !hasGemini) {
      return NextResponse.json({
        message: "I'd be happy to help! What would you like to know about cigars?",
        cigars: []
      })
    }

    const groq = hasGroq ? new Groq({ apiKey: groqKey! }) : null

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
        
        // Fetch reference images from inventory for better recognition
        const { getReferenceImagesFromInventory } = await import('@/lib/imageUtils')
        const referenceImages = await getReferenceImagesFromInventory(
          cigarsData.cigars as any[],
          12
        )
        const inventoryList = (cigarsData.cigars as any[])
          .map((c) => `${c.brand} - ${c.name}`)
          .join('\n')
        const refPrompt = referenceImages.length > 0
          ? `\n\nREFERENCE IMAGES: Below are ${referenceImages.length} product photos from our inventory. Compare the CUSTOMER'S PHOTO (the last image) to these. Use them to match band design, colors, and branding:\n${referenceImages
              .map((r, i) => `${i + 1}. ${r.brand} - ${r.name}`)
              .join('\n')}\n\nThe LAST image is the customer's cigar photo to identify.`
          : ''
        const inventoryPrompt = `\n${inventoryList}`
        
        // Use Scout as primary model (best accuracy based on testing)
        const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
        
        let response = ''
        let succeeded = false
        
        const visionPrompt = IMAGE_PROMPT + inventoryPrompt + refPrompt + (lastMessage ? `\n\nCustomer says: ${lastMessage}` : '')
        
        if (groq) {
          try {
            console.log(`[Chat] Using vision model: ${VISION_MODEL} (${referenceImages.length} references)`)
            const contentParts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [
              { type: 'text', text: visionPrompt },
            ]
            for (const ref of referenceImages) {
              contentParts.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${ref.base64}` } })
            }
            contentParts.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } })
            const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: contentParts }],
            model: VISION_MODEL,
            temperature: 0.3,
            max_tokens: 1200,
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
        }
        
        // Fallback to Gemini vision if Groq failed or wasn't configured
        if (!succeeded && hasGemini && geminiKey) {
          try {
            console.log('[Chat] Trying Gemini vision...')
            const genAI = new GoogleGenerativeAI(geminiKey)
            const model = genAI.getGenerativeModel({
              model: 'gemini-2.5-flash',
              generationConfig: { temperature: 0.3, maxOutputTokens: 1200 }
            })
            const geminiParts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
              { text: visionPrompt },
            ]
            for (const ref of referenceImages) {
              geminiParts.push({ inlineData: { data: ref.base64, mimeType: 'image/jpeg' } })
            }
            geminiParts.push({ inlineData: { data: base64Data, mimeType: mimeType || 'image/jpeg' } })
            const result = await model.generateContent(geminiParts)
            response = result.response.text() || ''
            if (response) succeeded = true
          } catch (geminiVisionError) {
            console.error(`[Chat] Gemini vision fallback failed:`, geminiVisionError)
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
        let cigars = enrichWithInventoryData(parsed.cigars)
        cigars = filterCigarsByInventory(cigars)
        if (cigars.length === 0 && parsed.cigars.length > 0) {
          return NextResponse.json({
            message: "I'm not certain that's in our inventory. Can you tell me what text you see on the band? Or describe the colors?",
            cigars: [],
            confidence: Math.min(parsed.confidence, 74)
          })
        }
        return NextResponse.json({
          message: parsed.message,
          cigars: cigars.slice(0, 2),
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

    // Build system prompt with inventory list and context about previously shown cigars
    const inventoryList = (cigarsData.cigars as any[])
      .map((c) => `${c.brand} - ${c.name}`)
      .join('\n')
    let systemPrompt = SYSTEM_PROMPT + `\n\nSTORE INVENTORY (you may ONLY recommend from this list):\n${inventoryList}`
    if (shownCigars.length > 0) {
      systemPrompt += `\n\n[Internal - do not mention to customer] Previously recommended cigars to avoid repeating: ${shownCigars.join(', ')}. Suggest different cigars for variety.`
    }

    let response = ''
    let succeeded = false
    let lastError = ''

    // Try Groq first (often higher rate limits), then Gemini as fallback
    if (groq) {
      try {
        console.log('[Chat] Trying Groq...')
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
        response = completion.choices[0]?.message?.content || ''
        if (response) {
          succeeded = true
          console.log('[Chat] Groq succeeded')
        } else {
          lastError = 'Groq returned empty response'
        }
      } catch (groqError: any) {
        lastError = `Groq: ${groqError?.message || String(groqError)}`
        console.error('[Chat] Groq failed:', lastError)
      }
    }

    // Fallback to Gemini if Groq failed or wasn't configured
    if (!succeeded && hasGemini && geminiKey) {
      const GEMINI_MODEL = 'gemini-2.5-flash' // stable; gemini-2.0-flash deprecated Mar 2026
      const tryGemini = async (retryAfter429 = false): Promise<boolean> => {
        try {
          if (retryAfter429) {
            console.log('[Chat] Retrying Gemini after rate limit (429)...')
            await new Promise((r) => setTimeout(r, 3000))
          } else {
            console.log(`[Chat] Trying Gemini (${GEMINI_MODEL})...`)
          }
          const genAI = new GoogleGenerativeAI(geminiKey)
          const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })
          const chatPrompt = [
            systemPrompt,
            ...messages.map((m: { role: string; content: string }) =>
              `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
            ),
            'Assistant:',
          ].join('\n\n')
          const result = await model.generateContent(chatPrompt)
          const resp = result?.response
          if (!resp) {
            console.error('[Chat] Gemini returned falsy response')
            lastError = lastError || 'Gemini: Empty response'
            return false
          }
          const blockReason = resp.promptFeedback?.blockReason
          if (blockReason) {
            console.error('[Chat] Gemini blocked prompt:', blockReason)
            lastError = lastError || `Gemini: Prompt blocked (${blockReason})`
            return false
          }
          const text = resp.text?.()
          const r = (typeof text === 'string' ? text : '').trim()
          if (r) {
            response = r
            return true
          }
          console.error('[Chat] Gemini returned empty text')
          lastError = lastError || 'Gemini: Empty output'
          return false
        } catch (e: any) {
          const msg = e?.message || String(e)
          console.error('[Chat] Gemini error:', msg)
          if (msg.includes('429') && !retryAfter429) {
            return tryGemini(true)
          }
          lastError = lastError || `Gemini: ${msg}`
          return false
        }
      }
      succeeded = await tryGemini(false)
      if (succeeded) console.log('[Chat] Gemini succeeded')
    } else if (!succeeded && !hasGemini) {
      console.error('[Chat] No Gemini key configured - add GEMINI_API_KEY to .env.local for fallback')
    }

    if (succeeded && response) {
      try {
        const parsed = parseModelResponse(response)
        let cigars = enrichWithInventoryData(parsed.cigars)

        // If user asked for a specific cigar, ensure we show its card
        const requestedCigar = findCigarFromUserMessage(lastMessage)
        if (requestedCigar) {
          const reqName = requestedCigar.name.toLowerCase()
          const reqBrand = requestedCigar.brand.toLowerCase()
          const alreadyIncluded = cigars.some(
            (c) => c.name.toLowerCase() === reqName && c.brand.toLowerCase() === reqBrand
          )
          if (!alreadyIncluded) {
            const enriched = enrichWithInventoryData([requestedCigar])[0]
            cigars = [enriched, ...cigars].slice(0, 2)
          }
        }

        return NextResponse.json({
          message: parsed.message,
          cigars: cigars.slice(0, 2)
        })
      } catch (parseError) {
        console.error('[Chat] Parse error, using raw response:', parseError)
        return NextResponse.json({
          message: response,
          cigars: []
        })
      }
    }
    // Never expose raw API errors to users - log for debugging only
    if (lastError) console.error('[Chat] Fallback failed:', lastError)
    return NextResponse.json({
      message: "Having trouble connecting. Please try again in a moment.",
      cigars: []
    })
    
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({
      message: "Having trouble connecting. Try again!",
      cigars: []
    })
  }
}
