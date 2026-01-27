/**
 * Compare Vision Models for Cigar Recognition
 * Tests each model separately to find the best performer
 */

const https = require('https');
const http = require('http');

const VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct', 
  'llama-3.2-11b-vision-preview'
];

const TEST_IMAGES = [
  { name: 'Cohiba Shorts', url: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Cohiba_Shorts.jpg', expected: 'Cohiba' },
  { name: 'Cohiba Robustos Box', url: 'https://upload.wikimedia.org/wikipedia/commons/0/06/A_slide_lid_box_of_Cohiba_Robustos.jpg', expected: 'Cohiba' },
  { name: 'Montecristo Cigar', url: 'https://upload.wikimedia.org/wikipedia/commons/d/d4/MonteCristo_Cigar.jpg', expected: 'Montecristo' },
  { name: 'Montecristo No. 4', url: 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Cigar_Montecristo_Number_4_J1.jpg', expected: 'Montecristo' },
  { name: 'Cohiba Habanos', url: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/Cohiba_Habanos_Cigars_from_Cuba.jpg', expected: 'Cohiba' },
  { name: 'Rolling Cuban', url: 'https://upload.wikimedia.org/wikipedia/commons/0/02/Rolling_a_Cuban_Cigar.jpg', expected: 'Cuban' },
];

// Fetch image as base64
function fetchImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/*'
      }
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        fetchImage(response.headers.location).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = response.headers['content-type'] || 'image/jpeg';
        resolve(`data:${contentType};base64,${buffer.toString('base64')}`);
      });
      response.on('error', reject);
    });
    request.on('error', reject);
    request.setTimeout(30000, () => { request.destroy(); reject(new Error('Timeout')); });
  });
}

// Test single image with specific model via direct Groq API
async function testWithModel(imageBase64, modelName) {
  const Groq = require('groq-sdk');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  
  const base64Data = imageBase64.split(',')[1];
  const mimeType = imageBase64.split(';')[0].split(':')[1] || 'image/jpeg';
  
  const prompt = `You are an expert cigar identifier. Analyze this image and identify the cigar.

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "confidence": <number 0-100>,
  "identified": <true/false>,
  "cigar": "<cigar name or null>",
  "brand": "<brand name or null>"
}

Be aggressive in identification - if you can see any brand markings, wrapper color, or shape that suggests a specific cigar, provide your best guess with appropriate confidence.`;

  try {
    const startTime = Date.now();
    const completion = await groq.chat.completions.create({
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
        ]
      }],
      model: modelName,
      max_tokens: 500,
      temperature: 0.3
    });
    
    const responseTime = Date.now() - startTime;
    const response = completion.choices[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        confidence: parsed.confidence || 0,
        identified: parsed.identified || false,
        cigar: parsed.cigar || null,
        brand: parsed.brand || null,
        responseTime
      };
    }
    return { success: true, confidence: 0, identified: false, cigar: null, responseTime };
  } catch (error) {
    return { success: false, error: error.message, confidence: 0, identified: false };
  }
}

async function runComparison() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║           VISION MODEL COMPARISON FOR CIGAR RECOGNITION              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
  
  // First, fetch all images
  console.log('Fetching test images...\n');
  const images = [];
  for (const test of TEST_IMAGES) {
    try {
      process.stdout.write(`  ${test.name}... `);
      const imageData = await fetchImage(test.url);
      images.push({ ...test, imageData });
      console.log('✓');
    } catch (e) {
      console.log(`✗ (${e.message})`);
    }
  }
  
  console.log(`\nLoaded ${images.length} images. Testing each model...\n`);
  
  const results = {};
  
  for (const model of VISION_MODELS) {
    const shortName = model.split('/').pop();
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`MODEL: ${shortName}`);
    console.log('═'.repeat(70));
    
    results[model] = {
      name: shortName,
      tests: [],
      identified: 0,
      correct: 0,
      totalConfidence: 0,
      totalTime: 0,
      errors: 0
    };
    
    for (const img of images) {
      process.stdout.write(`  Testing ${img.name}... `);
      
      const result = await testWithModel(img.imageData, model);
      
      if (result.success) {
        const matchesExpected = result.cigar?.toLowerCase().includes(img.expected.toLowerCase()) ||
                               result.brand?.toLowerCase().includes(img.expected.toLowerCase());
        
        results[model].tests.push({
          image: img.name,
          expected: img.expected,
          identified: result.identified,
          cigar: result.cigar,
          confidence: result.confidence,
          correct: matchesExpected,
          responseTime: result.responseTime
        });
        
        if (result.identified) results[model].identified++;
        if (matchesExpected && result.identified) results[model].correct++;
        results[model].totalConfidence += result.confidence;
        results[model].totalTime += result.responseTime;
        
        const icon = result.identified ? (matchesExpected ? '✓' : '≈') : '✗';
        console.log(`${icon} ${result.confidence}% - ${result.cigar || 'Not identified'} (${result.responseTime}ms)`);
      } else {
        results[model].errors++;
        console.log(`ERROR: ${result.error}`);
      }
      
      // Small delay between requests
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  // Print summary
  console.log('\n\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                          RESULTS SUMMARY                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
  
  console.log('┌─────────────────────────────────────┬──────────┬──────────┬──────────┬──────────┐');
  console.log('│ Model                               │ ID Rate  │ Accuracy │ Avg Conf │ Avg Time │');
  console.log('├─────────────────────────────────────┼──────────┼──────────┼──────────┼──────────┤');
  
  const modelRankings = [];
  
  for (const model of VISION_MODELS) {
    const r = results[model];
    const testCount = r.tests.length;
    const idRate = testCount > 0 ? Math.round((r.identified / testCount) * 100) : 0;
    const accuracy = r.identified > 0 ? Math.round((r.correct / r.identified) * 100) : 0;
    const avgConf = testCount > 0 ? Math.round(r.totalConfidence / testCount) : 0;
    const avgTime = testCount > 0 ? Math.round(r.totalTime / testCount) : 0;
    
    modelRankings.push({ model, name: r.name, idRate, accuracy, avgConf, avgTime, score: idRate + accuracy + avgConf });
    
    console.log(`│ ${r.name.padEnd(35)} │ ${(idRate + '%').padStart(6)}   │ ${(accuracy + '%').padStart(6)}   │ ${(avgConf + '%').padStart(6)}   │ ${(avgTime + 'ms').padStart(6)}   │`);
  }
  
  console.log('└─────────────────────────────────────┴──────────┴──────────┴──────────┴──────────┘');
  
  // Determine winner
  modelRankings.sort((a, b) => b.score - a.score);
  const winner = modelRankings[0];
  
  console.log(`\n🏆 BEST MODEL: ${winner.name}`);
  console.log(`   - Identification Rate: ${winner.idRate}%`);
  console.log(`   - Accuracy: ${winner.accuracy}%`);
  console.log(`   - Average Confidence: ${winner.avgConf}%`);
  console.log(`   - Average Response Time: ${winner.avgTime}ms`);
  
  // Detailed breakdown
  console.log('\n\nDETAILED RESULTS BY IMAGE:');
  console.log('─'.repeat(90));
  
  for (const img of images) {
    console.log(`\n${img.name} (Expected: ${img.expected})`);
    for (const model of VISION_MODELS) {
      const test = results[model].tests.find(t => t.image === img.name);
      if (test) {
        const status = test.identified ? (test.correct ? '✓' : '≈') : '✗';
        const shortModel = model.split('/').pop().substring(0, 20);
        console.log(`  ${shortModel.padEnd(22)} ${status} ${String(test.confidence).padStart(3)}% ${(test.cigar || '-').padEnd(25)} ${test.responseTime}ms`);
      }
    }
  }
  
  console.log('\n\nLegend: ✓ = Correct identification, ≈ = Identified but wrong, ✗ = Not identified\n');
}

runComparison().catch(console.error);
