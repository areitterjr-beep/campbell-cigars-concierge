import { NextResponse } from 'next/server'

/**
 * Diagnostic endpoint to verify production environment.
 * Call GET /api/health to check if API keys are configured.
 * Does NOT expose actual key values.
 */
export async function GET() {
  const groqKey = process.env.GROQ_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY

  const hasGroq = !!(groqKey && groqKey !== 'your_groq_api_key_here')
  const hasGemini = !!(geminiKey && geminiKey !== 'your_gemini_api_key_here')

  return NextResponse.json({
    ok: hasGroq || hasGemini,
    groq: hasGroq ? 'configured' : 'missing',
    gemini: hasGemini ? 'configured' : 'missing',
    hint: !hasGroq && !hasGemini
      ? 'Add GROQ_API_KEY or GEMINI_API_KEY to Vercel → Project Settings → Environment Variables (Production)'
      : undefined,
  })
}
