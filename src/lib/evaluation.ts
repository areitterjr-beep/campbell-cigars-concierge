/**
 * Image Recognition Evaluation System
 * 
 * This module provides tools to evaluate the cigar image recognition system.
 * It tests confidence scoring, accuracy, and the clarification guardrail.
 */

export interface EvaluationCase {
  id: string
  description: string
  imageUrl?: string // URL or base64 data
  expectedCigar?: string // Expected cigar name if identifiable
  expectedConfidenceRange: [number, number] // [min, max] expected confidence
  shouldIdentify: boolean // Whether the system should confidently identify
  tags: string[] // Categories like 'clear-band', 'blurry', 'partial', etc.
}

export interface EvaluationResult {
  caseId: string
  passed: boolean
  actualConfidence: number
  expectedConfidenceRange: [number, number]
  identifiedCigar: string | null
  expectedCigar: string | null
  shouldIdentify: boolean
  didIdentify: boolean
  responseTime: number
  message: string
  errors: string[]
}

export interface EvaluationSummary {
  totalCases: number
  passed: number
  failed: number
  passRate: number
  averageConfidence: number
  averageResponseTime: number
  confidenceAccuracy: number // How often confidence matched expected range
  identificationAccuracy: number // How often identification matched expected
  guardrailAccuracy: number // How often low-confidence cases asked for clarification
  results: EvaluationResult[]
}

// Predefined test cases for evaluation
export const TEST_CASES: EvaluationCase[] = [
  {
    id: 'clear-padron',
    description: 'Clear image of Padron 1964 Anniversary with visible band',
    expectedCigar: 'Padron 1964 Anniversary',
    expectedConfidenceRange: [75, 100],
    shouldIdentify: true,
    tags: ['clear-band', 'premium', 'well-known']
  },
  {
    id: 'clear-arturo-fuente',
    description: 'Clear image of Arturo Fuente Hemingway with visible band text',
    expectedCigar: 'Arturo Fuente Hemingway',
    expectedConfidenceRange: [75, 100],
    shouldIdentify: true,
    tags: ['clear-band', 'premium', 'well-known']
  },
  {
    id: 'partial-band',
    description: 'Partially visible band, some text readable',
    expectedConfidenceRange: [40, 70],
    shouldIdentify: false,
    tags: ['partial', 'unclear']
  },
  {
    id: 'blurry-image',
    description: 'Blurry image where band details are not readable',
    expectedConfidenceRange: [0, 40],
    shouldIdentify: false,
    tags: ['blurry', 'low-quality']
  },
  {
    id: 'wrapper-only',
    description: 'Image shows wrapper clearly but band is not visible',
    expectedConfidenceRange: [20, 50],
    shouldIdentify: false,
    tags: ['no-band', 'wrapper-visible']
  },
  {
    id: 'maduro-wrapper',
    description: 'Dark maduro wrapper visible, band partially obscured',
    expectedConfidenceRange: [30, 60],
    shouldIdentify: false,
    tags: ['partial', 'maduro']
  },
  {
    id: 'connecticut-wrapper',
    description: 'Light Connecticut wrapper, band clearly visible',
    expectedConfidenceRange: [60, 90],
    shouldIdentify: true,
    tags: ['clear-band', 'connecticut']
  },
  {
    id: 'box-image',
    description: 'Image of cigar box rather than individual cigar',
    expectedConfidenceRange: [50, 85],
    shouldIdentify: true,
    tags: ['box', 'brand-visible']
  },
  {
    id: 'multiple-cigars',
    description: 'Image with multiple cigars, bands visible',
    expectedConfidenceRange: [40, 70],
    shouldIdentify: false, // Should ask which one
    tags: ['multiple', 'ambiguous']
  },
  {
    id: 'unknown-brand',
    description: 'Clear image but of an uncommon/unknown brand',
    expectedConfidenceRange: [30, 60],
    shouldIdentify: false,
    tags: ['unknown', 'rare']
  }
]

/**
 * Run a single evaluation case
 */
export async function runEvaluationCase(
  testCase: EvaluationCase,
  apiEndpoint: string = '/api/chat'
): Promise<EvaluationResult> {
  const startTime = Date.now()
  const errors: string[] = []
  
  try {
    // For actual testing, you'd send the image to the API
    // This is a mock implementation - replace with actual API calls
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What cigar is this?' }],
        image: testCase.imageUrl || 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' // placeholder
      })
    })
    
    const data = await response.json()
    const responseTime = Date.now() - startTime
    
    const actualConfidence = data.confidence ?? 50
    const identifiedCigar = data.cigars?.[0]?.name ?? null
    const didIdentify = data.cigars?.length > 0
    
    // Check if confidence is in expected range
    const confidenceInRange = 
      actualConfidence >= testCase.expectedConfidenceRange[0] &&
      actualConfidence <= testCase.expectedConfidenceRange[1]
    
    // Check if identification matches expectation
    const identificationCorrect = testCase.shouldIdentify === didIdentify
    
    // Check guardrail - low confidence should NOT identify
    const guardrailWorking = actualConfidence < 60 ? !didIdentify : true
    
    // Overall pass/fail
    const passed = confidenceInRange && identificationCorrect && guardrailWorking
    
    if (!confidenceInRange) {
      errors.push(`Confidence ${actualConfidence} not in expected range [${testCase.expectedConfidenceRange}]`)
    }
    if (!identificationCorrect) {
      errors.push(`Expected ${testCase.shouldIdentify ? 'to identify' : 'NOT to identify'}, but ${didIdentify ? 'did identify' : 'did not identify'}`)
    }
    if (!guardrailWorking) {
      errors.push(`Guardrail failed: confidence ${actualConfidence} < 60 but still identified`)
    }
    
    return {
      caseId: testCase.id,
      passed,
      actualConfidence,
      expectedConfidenceRange: testCase.expectedConfidenceRange,
      identifiedCigar,
      expectedCigar: testCase.expectedCigar || null,
      shouldIdentify: testCase.shouldIdentify,
      didIdentify,
      responseTime,
      message: data.message || '',
      errors
    }
  } catch (error) {
    return {
      caseId: testCase.id,
      passed: false,
      actualConfidence: 0,
      expectedConfidenceRange: testCase.expectedConfidenceRange,
      identifiedCigar: null,
      expectedCigar: testCase.expectedCigar || null,
      shouldIdentify: testCase.shouldIdentify,
      didIdentify: false,
      responseTime: Date.now() - startTime,
      message: '',
      errors: [`API Error: ${error}`]
    }
  }
}

/**
 * Run all evaluation cases and generate summary
 */
export async function runFullEvaluation(
  cases: EvaluationCase[] = TEST_CASES,
  apiEndpoint: string = '/api/chat'
): Promise<EvaluationSummary> {
  const results: EvaluationResult[] = []
  
  for (const testCase of cases) {
    console.log(`Running evaluation: ${testCase.id}...`)
    const result = await runEvaluationCase(testCase, apiEndpoint)
    results.push(result)
  }
  
  const passed = results.filter(r => r.passed).length
  const failed = results.length - passed
  
  const confidenceResults = results.filter(r => 
    r.actualConfidence >= r.expectedConfidenceRange[0] &&
    r.actualConfidence <= r.expectedConfidenceRange[1]
  )
  
  const identificationResults = results.filter(r => 
    r.shouldIdentify === r.didIdentify
  )
  
  const guardrailResults = results.filter(r =>
    r.actualConfidence >= 60 || !r.didIdentify
  )
  
  return {
    totalCases: results.length,
    passed,
    failed,
    passRate: (passed / results.length) * 100,
    averageConfidence: results.reduce((sum, r) => sum + r.actualConfidence, 0) / results.length,
    averageResponseTime: results.reduce((sum, r) => sum + r.responseTime, 0) / results.length,
    confidenceAccuracy: (confidenceResults.length / results.length) * 100,
    identificationAccuracy: (identificationResults.length / results.length) * 100,
    guardrailAccuracy: (guardrailResults.length / results.length) * 100,
    results
  }
}

/**
 * Format evaluation summary as readable report
 */
export function formatEvaluationReport(summary: EvaluationSummary): string {
  let report = `
═══════════════════════════════════════════════════════════════
                 IMAGE RECOGNITION EVALUATION REPORT
═══════════════════════════════════════════════════════════════

OVERALL RESULTS
───────────────────────────────────────────────────────────────
Total Test Cases:      ${summary.totalCases}
Passed:                ${summary.passed} (${summary.passRate.toFixed(1)}%)
Failed:                ${summary.failed}

METRICS
───────────────────────────────────────────────────────────────
Average Confidence:    ${summary.averageConfidence.toFixed(1)}%
Avg Response Time:     ${summary.averageResponseTime.toFixed(0)}ms
Confidence Accuracy:   ${summary.confidenceAccuracy.toFixed(1)}%
Identification Accuracy: ${summary.identificationAccuracy.toFixed(1)}%
Guardrail Accuracy:    ${summary.guardrailAccuracy.toFixed(1)}%

INDIVIDUAL RESULTS
───────────────────────────────────────────────────────────────
`

  for (const result of summary.results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL'
    report += `
${status} | ${result.caseId}
  Confidence: ${result.actualConfidence}% (expected: ${result.expectedConfidenceRange[0]}-${result.expectedConfidenceRange[1]}%)
  Identified: ${result.didIdentify ? result.identifiedCigar : 'No'} (expected: ${result.shouldIdentify ? 'Yes' : 'No'})
  Response Time: ${result.responseTime}ms
`
    if (result.errors.length > 0) {
      report += `  Errors: ${result.errors.join(', ')}\n`
    }
  }

  report += `
═══════════════════════════════════════════════════════════════
                         END OF REPORT
═══════════════════════════════════════════════════════════════
`

  return report
}

/**
 * Quick confidence check for a single image response
 */
export function checkConfidenceGuardrail(confidence: number, hasCigarResult: boolean): {
  passed: boolean
  message: string
} {
  if (confidence < 60 && hasCigarResult) {
    return {
      passed: false,
      message: `GUARDRAIL VIOLATION: Confidence ${confidence}% is below 60% threshold but cigar was still identified. Should ask clarifying questions instead.`
    }
  }
  
  if (confidence >= 60 && !hasCigarResult) {
    return {
      passed: true, // This is okay - high confidence but chose not to show (could be other reasons)
      message: `Note: High confidence (${confidence}%) but no cigar shown. This may be intentional.`
    }
  }
  
  return {
    passed: true,
    message: confidence >= 60 
      ? `OK: Confidence ${confidence}% meets threshold, cigar identified.`
      : `OK: Confidence ${confidence}% below threshold, asking for clarification.`
  }
}
