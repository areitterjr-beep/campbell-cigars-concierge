/**
 * Cigar Image Validation Script
 * Fetches each imageUrl in cigars.json and reports:
 * - Missing or empty imageUrl
 * - Non-200 response (404, 500, redirect, etc.)
 * - Wrong Content-Type (not image/*)
 * - Suspiciously small files (< 5KB = likely placeholder)
 *
 * Run: node scripts/validate-images.js
 */

const fs = require('fs');
const path = require('path');

const MIN_SIZE_KB = 5;
const CONCURRENCY = 5;
const TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    return res;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

async function validateImage(url, brand, name) {
  const result = { url, brand, name, ok: true, issues: [] };

  try {
    const res = await fetchWithTimeout(url, { method: 'HEAD' });

    if (!res.ok) {
      result.ok = false;
      result.issues.push(`HTTP ${res.status} ${res.statusText}`);
      return result;
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      result.ok = false;
      result.issues.push(`Wrong Content-Type: ${contentType || '(empty)'}`);
      return result;
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength) {
      const sizeKb = parseInt(contentLength, 10) / 1024;
      if (sizeKb < MIN_SIZE_KB) {
        result.ok = false;
        result.issues.push(`Too small: ${sizeKb.toFixed(1)}KB (likely placeholder)`);
      }
    } else {
      // No Content-Length - do a GET and check actual size
      const getRes = await fetchWithTimeout(url);
      const buf = await getRes.arrayBuffer();
      const sizeKb = buf.byteLength / 1024;
      if (sizeKb < MIN_SIZE_KB) {
        result.ok = false;
        result.issues.push(`Too small: ${sizeKb.toFixed(1)}KB (likely placeholder)`);
      }
    }
  } catch (e) {
    result.ok = false;
    const msg = e.name === 'AbortError' ? 'Timeout' : e.message;
    result.issues.push(`Fetch failed: ${msg}`);
  }

  return result;
}

async function runWithConcurrency(items, fn, concurrency) {
  const results = [];
  const executing = new Set();

  for (const item of items) {
    const p = fn(item).then((r) => {
      executing.delete(p);
      return r;
    });
    executing.add(p);
    results.push(p);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

async function main() {
  const cigarsPath = path.join(__dirname, '../src/data/cigars.json');
  const data = JSON.parse(fs.readFileSync(cigarsPath, 'utf8'));
  const cigars = data.cigars || [];

  const withImages = cigars.filter((c) => c.imageUrl && c.imageUrl.startsWith('http'));
  const missing = cigars.filter((c) => !c.imageUrl || !c.imageUrl.startsWith('http'));

  console.log('\n=== Cigar Image Validation ===\n');
  console.log(`Total cigars: ${cigars.length}`);
  console.log(`With imageUrl: ${withImages.length}`);
  console.log(`Missing/empty: ${missing.length}\n`);

  if (missing.length > 0) {
    console.log('--- Missing imageUrl ---');
    missing.forEach((c) => console.log(`  ${c.brand} - ${c.name}`));
    console.log('');
  }

  console.log('Validating image URLs...\n');

  const results = await runWithConcurrency(
    withImages.map((c) => ({ url: c.imageUrl, brand: c.brand, name: c.name })),
    ({ url, brand, name }) => validateImage(url, brand, name),
    CONCURRENCY
  );

  const failed = results.filter((r) => !r.ok);

  if (failed.length === 0) {
    console.log(`✓ All ${withImages.length} images passed validation.\n`);
    return;
  }

  console.log(`✗ ${failed.length} image(s) have issues:\n`);
  failed.forEach((r) => {
    console.log(`  ${r.brand} - ${r.name}`);
    console.log(`    URL: ${r.url}`);
    r.issues.forEach((i) => console.log(`    → ${i}`));
    console.log('');
  });

  process.exit(1);
}

main().catch((e) => {
  console.error('Script failed:', e);
  process.exit(1);
});
