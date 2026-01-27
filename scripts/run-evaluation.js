/**
 * Cigar Image Recognition Evaluation Script
 * Downloads cigar images from the web and tests them through the evaluation API
 */

const https = require('https');
const http = require('http');

// Test images - real cigar photos from Wikipedia Commons
const TEST_IMAGES = [
  {
    name: 'Cohiba Shorts',
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Cohiba_Shorts.jpg',
    expected: 'Cohiba'
  },
  {
    name: 'Cohiba Robustos Box',
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/06/A_slide_lid_box_of_Cohiba_Robustos.jpg',
    expected: 'Cohiba'
  },
  {
    name: 'Montecristo Cigar',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d4/MonteCristo_Cigar.jpg',
    expected: 'Montecristo'
  },
  {
    name: 'Montecristo No. 4',
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/fe/Cigar_Montecristo_Number_4_J1.jpg',
    expected: 'Montecristo'
  },
  {
    name: 'Cohiba Habanos Cuban',
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/Cohiba_Habanos_Cigars_from_Cuba.jpg',
    expected: 'Cohiba'
  },
  {
    name: 'Rolling Cuban Cigar',
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/02/Rolling_a_Cuban_Cigar.jpg',
    expected: 'Cuban'
  },
  {
    name: 'Cigar Wrapper Colors',
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/50/Cigar_Wrapper_Color_Chart.jpg',
    expected: 'cigar'
  },
  {
    name: 'Rollin Cigar Making',
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Rollin_Cigar.jpg',
    expected: 'cigar'
  }
];

const API_URL = 'http://localhost:3001/api/evaluate';

// Fetch image and convert to base64
function fetchImageAsBase64(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/'
      }
    }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        fetchImageAsBase64(response.headers.location).then(resolve).catch(reject);
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
        const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;
        resolve(base64);
      });
      response.on('error', reject);
    });
    
    request.on('error', reject);
    request.setTimeout(45000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Send image to evaluation API
function evaluateImage(imageBase64, testName) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      image: imageBase64,
      notes: `Automated test: ${testName}`
    });
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/evaluate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('API Timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

// Run all tests
async function runEvaluation() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║      CIGAR IMAGE RECOGNITION EVALUATION                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const results = [];
  
  for (let i = 0; i < TEST_IMAGES.length; i++) {
    const test = TEST_IMAGES[i];
    console.log(`\n[${i + 1}/${TEST_IMAGES.length}] Testing: ${test.name}`);
    console.log(`    Expected: ${test.expected}`);
    
    try {
      // Fetch image
      process.stdout.write('    Fetching image... ');
      const imageBase64 = await fetchImageAsBase64(test.url);
      console.log('✓');
      
      // Evaluate
      process.stdout.write('    Running evaluation... ');
      const response = await evaluateImage(imageBase64, test.name);
      console.log('✓');
      
      if (response.evaluation) {
        const eval_ = response.evaluation;
        const identified = eval_.identifiedCigar || 'Not identified';
        const matchesExpected = identified.toLowerCase().includes(test.expected.toLowerCase());
        
        results.push({
          test: test.name,
          expected: test.expected,
          identified: identified,
          confidence: eval_.confidence,
          guardrailPassed: eval_.guardrailPassed,
          responseTime: eval_.responseTime,
          matchesExpected
        });
        
        console.log(`    ─────────────────────────────────────`);
        console.log(`    Identified:  ${identified}`);
        console.log(`    Confidence:  ${eval_.confidence}% (${eval_.confidenceLevel})`);
        console.log(`    Guardrail:   ${eval_.guardrailPassed ? '✓ Passed' : '✗ Failed'}`);
        console.log(`    Response:    ${eval_.responseTime}ms`);
        console.log(`    Match:       ${matchesExpected ? '✓ Correct' : '✗ Incorrect'}`);
      } else {
        console.log(`    ✗ Error: ${response.error || 'Unknown error'}`);
        results.push({
          test: test.name,
          expected: test.expected,
          identified: 'ERROR',
          confidence: 0,
          guardrailPassed: false,
          responseTime: 0,
          matchesExpected: false,
          error: response.error
        });
      }
    } catch (error) {
      console.log(`✗ Failed: ${error.message}`);
      results.push({
        test: test.name,
        expected: test.expected,
        identified: 'FETCH ERROR',
        confidence: 0,
        guardrailPassed: false,
        responseTime: 0,
        matchesExpected: false,
        error: error.message
      });
    }
  }
  
  // Print summary
  console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      EVALUATION SUMMARY                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const successful = results.filter(r => !r.error);
  const correct = results.filter(r => r.matchesExpected);
  const guardrailPassed = results.filter(r => r.guardrailPassed);
  const avgConfidence = successful.length > 0 
    ? Math.round(successful.reduce((sum, r) => sum + r.confidence, 0) / successful.length)
    : 0;
  const avgResponseTime = successful.length > 0
    ? Math.round(successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length)
    : 0;
  
  console.log('┌────────────────────────────────────────────────────────────────┐');
  console.log(`│ Total Tests:        ${results.length.toString().padEnd(43)}│`);
  console.log(`│ Successful:         ${successful.length.toString().padEnd(43)}│`);
  console.log(`│ Correct ID:         ${correct.length}/${successful.length} (${successful.length > 0 ? Math.round(correct.length/successful.length*100) : 0}%)`.padEnd(65) + '│');
  console.log(`│ Guardrail Pass:     ${guardrailPassed.length}/${successful.length} (${successful.length > 0 ? Math.round(guardrailPassed.length/successful.length*100) : 0}%)`.padEnd(65) + '│');
  console.log(`│ Avg Confidence:     ${avgConfidence}%`.padEnd(65) + '│');
  console.log(`│ Avg Response Time:  ${avgResponseTime}ms`.padEnd(65) + '│');
  console.log('└────────────────────────────────────────────────────────────────┘');
  
  console.log('\n\nDetailed Results:');
  console.log('─'.repeat(90));
  console.log('Test'.padEnd(30) + 'Expected'.padEnd(15) + 'Identified'.padEnd(25) + 'Conf'.padEnd(8) + 'Match');
  console.log('─'.repeat(90));
  
  results.forEach(r => {
    const matchIcon = r.error ? '⚠️' : (r.matchesExpected ? '✓' : '✗');
    const identified = (r.identified || 'N/A').substring(0, 23);
    console.log(
      r.test.substring(0, 28).padEnd(30) +
      r.expected.padEnd(15) +
      identified.padEnd(25) +
      `${r.confidence}%`.padEnd(8) +
      matchIcon
    );
  });
  
  console.log('─'.repeat(90));
  console.log('\n✅ Evaluation complete! Results saved to dashboard at http://localhost:3001/evaluate\n');
}

// Run
runEvaluation().catch(console.error);
