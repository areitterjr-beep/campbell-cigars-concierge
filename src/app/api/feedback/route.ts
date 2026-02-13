import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export const maxDuration = 10

const DATA_FILE = path.join(process.cwd(), 'src/data/feedback.json')

// Same admin password pattern as /api/inventory
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

interface FeedbackEntry {
  id: string
  sessionId: string
  timestamp: string
  rating: 'up' | 'down'
  comment?: string
  userMessage: string
  assistantMessage: string
  cigarsShown: string[]
  userAgent: string
}

// POST — Save a new feedback entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      sessionId,
      rating,
      comment,
      userMessage,
      assistantMessage,
      cigarsShown,
    } = body

    if (!sessionId || !rating || !assistantMessage) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, rating, assistantMessage' },
        { status: 400 }
      )
    }

    if (rating !== 'up' && rating !== 'down') {
      return NextResponse.json(
        { error: 'rating must be "up" or "down"' },
        { status: 400 }
      )
    }

    const entry: FeedbackEntry = {
      id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sessionId,
      timestamp: new Date().toISOString(),
      rating,
      ...(comment ? { comment } : {}),
      userMessage: userMessage || '',
      assistantMessage,
      cigarsShown: cigarsShown || [],
      userAgent: request.headers.get('user-agent') || 'unknown',
    }

    // Always log to console (visible in Vercel runtime logs)
    console.log('[FEEDBACK]', JSON.stringify(entry))

    // Attempt file write (works locally, may fail on Vercel read-only FS)
    try {
      const raw = await fs.readFile(DATA_FILE, 'utf-8')
      const data = JSON.parse(raw)
      data.feedback.push(entry)
      await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2))
    } catch (fileErr) {
      // On Vercel production the filesystem is read-only — this is expected.
      // The console.log above ensures the data is still captured in Vercel logs.
      console.warn('[FEEDBACK] Could not write to file (expected on Vercel):', (fileErr as Error).message)
    }

    return NextResponse.json({ success: true, id: entry.id })
  } catch (error) {
    console.error('[FEEDBACK] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    )
  }
}

// GET — Retrieve feedback entries (admin only)
export async function GET(request: NextRequest) {
  try {
    const password = request.headers.get('x-admin-password')
    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ratingFilter = searchParams.get('rating') // "up" | "down" | null
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 200

    let entries: FeedbackEntry[] = []

    try {
      const raw = await fs.readFile(DATA_FILE, 'utf-8')
      const data = JSON.parse(raw)
      entries = data.feedback || []
    } catch {
      // File doesn't exist or unreadable — return empty
      return NextResponse.json({ feedback: [], total: 0 })
    }

    // Filter by rating if requested
    if (ratingFilter === 'up' || ratingFilter === 'down') {
      entries = entries.filter((e) => e.rating === ratingFilter)
    }

    // Sort newest first and apply limit
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    const limited = entries.slice(0, limit)

    return NextResponse.json({ feedback: limited, total: entries.length })
  } catch (error) {
    console.error('[FEEDBACK] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    )
  }
}
