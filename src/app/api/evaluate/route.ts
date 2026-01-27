import { NextRequest, NextResponse } from 'next/server'
import { 
  runFullEvaluation, 
  formatEvaluationReport, 
  TEST_CASES,
  checkConfidenceGuardrail 
} from '@/lib/evaluation'
import { promises as fs } from 'fs'
import path from 'path'

const EVALUATIONS_FILE = path.join(process.cwd(), 'src/data/evaluations.json')

interface StoredEvaluation {
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
  imageData?: string // Store the image for reference
}

async function loadEvaluations(): Promise<StoredEvaluation[]> {
  try {
    const data = await fs.readFile(EVALUATIONS_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    return parsed.evaluations || []
  } catch {
    return []
  }
}

async function saveEvaluations(evaluations: StoredEvaluation[]): Promise<void> {
  await fs.writeFile(EVALUATIONS_FILE, JSON.stringify({ evaluations }, null, 2))
}

/**
 * GET /api/evaluate - Get evaluation info and history
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    // Return stored evaluations history
    if (action === 'history') {
      const evaluations = await loadEvaluations()
      
      // Calculate stats
      const stats = {
        totalTests: evaluations.length,
        avgConfidence: evaluations.length > 0 
          ? Math.round(evaluations.reduce((sum, e) => sum + e.confidence, 0) / evaluations.length)
          : 0,
        guardrailPassRate: evaluations.length > 0
          ? Math.round((evaluations.filter(e => e.guardrailPassed).length / evaluations.length) * 100)
          : 0,
        avgResponseTime: evaluations.length > 0
          ? Math.round(evaluations.reduce((sum, e) => sum + e.responseTime, 0) / evaluations.length)
          : 0,
        identificationRate: evaluations.length > 0
          ? Math.round((evaluations.filter(e => e.identified).length / evaluations.length) * 100)
          : 0
      }
      
      return NextResponse.json({ evaluations, stats })
    }
    
    // Default: return test case definitions
    return NextResponse.json({
      status: 'evaluation_framework_ready',
      testCases: TEST_CASES.map(tc => ({
        id: tc.id,
        description: tc.description,
        expectedConfidenceRange: tc.expectedConfidenceRange,
        shouldIdentify: tc.shouldIdentify,
        tags: tc.tags
      })),
      guardrailThreshold: 60,
      instructions: `
        To run actual evaluation:
        1. POST to /api/evaluate with test images
        2. Or use the evaluation UI at /evaluate
        3. Each image will be scored for confidence and checked against the 60% guardrail
      `
    })
  } catch (error) {
    console.error('Evaluation error:', error)
    return NextResponse.json({ error: 'Evaluation failed' }, { status: 500 })
  }
}

/**
 * POST /api/evaluate - Evaluate a single image or run tests
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Single image evaluation
    if (body.image) {
      const startTime = Date.now()
      
      // Call the chat API with the image
      const chatResponse = await fetch(new URL('/api/chat', request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: body.message || 'What cigar is this?' }],
          image: body.image
        })
      })
      
      const chatData = await chatResponse.json()
      const responseTime = Date.now() - startTime
      
      const confidence = chatData.confidence ?? 50
      const hasCigar = chatData.cigars?.length > 0
      const guardrailCheck = checkConfidenceGuardrail(confidence, hasCigar)
      
      const evaluation: StoredEvaluation = {
        id: `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        confidence,
        confidenceLevel: confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low',
        identified: hasCigar,
        identifiedCigar: hasCigar ? chatData.cigars[0].name : null,
        guardrailPassed: guardrailCheck.passed,
        guardrailMessage: guardrailCheck.message,
        responseTime,
        meetsThreshold: confidence >= 60,
        aiResponse: chatData.message,
        notes: body.notes || undefined,
        imageData: body.image // Store the image for display in dashboard
      }
      
      // Save to history
      const existingEvaluations = await loadEvaluations()
      existingEvaluations.unshift(evaluation) // Add to beginning
      await saveEvaluations(existingEvaluations)
      
      return NextResponse.json({
        evaluation,
        response: chatData
      })
    }
    
    // Batch evaluation with test cases
    if (body.runTests) {
      // This would run actual tests with provided images
      return NextResponse.json({
        message: 'Batch evaluation not yet implemented. Provide individual images for testing.',
        testCases: TEST_CASES.length
      })
    }
    
    return NextResponse.json({ 
      error: 'Please provide an image to evaluate or set runTests: true' 
    }, { status: 400 })
    
  } catch (error) {
    console.error('Evaluation error:', error)
    return NextResponse.json({ error: 'Evaluation failed' }, { status: 500 })
  }
}

/**
 * DELETE /api/evaluate - Clear evaluation history
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (id) {
      // Delete single evaluation
      const evaluations = await loadEvaluations()
      const filtered = evaluations.filter(e => e.id !== id)
      await saveEvaluations(filtered)
      return NextResponse.json({ success: true, deleted: id })
    }
    
    // Clear all evaluations
    await saveEvaluations([])
    return NextResponse.json({ success: true, message: 'All evaluations cleared' })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete evaluations' }, { status: 500 })
  }
}
