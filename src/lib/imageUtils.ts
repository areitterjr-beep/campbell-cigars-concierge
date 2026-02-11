/**
 * Image utilities for compression and processing
 */

// Cache for reference images (avoids refetching on every request)
let referenceImagesCache: { images: Array<{ brand: string; name: string; base64: string }>; fetchedAt: number } | null = null
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Fetch image from URL and return as base64. Resizes to thumbnail for reference use.
 */
export async function fetchImageAsBase64(url: string, maxSize = 256): Promise<string | null> {
  try {
    const fullUrl = url.startsWith('//') ? `https:${url}` : url
    const res = await fetch(fullUrl, { headers: { 'User-Agent': 'CampbellCigars/1.0' } })
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const sharp = require('sharp')
    const resized = await sharp(buffer)
      .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer()
    return resized.toString('base64')
  } catch {
    return null
  }
}

/**
 * Get reference images from inventory for vision model training/context.
 * Returns a curated set of cigars (diverse brands) with their product images as base64.
 */
export async function getReferenceImagesFromInventory(
  cigars: Array<{ brand: string; name: string; imageUrl?: string }>,
  count = 8
): Promise<Array<{ brand: string; name: string; base64: string }>> {
  if (referenceImagesCache && Date.now() - referenceImagesCache.fetchedAt < CACHE_TTL_MS) {
    return referenceImagesCache.images
  }
  const withImages = cigars.filter((c) => c.imageUrl && c.imageUrl.startsWith('http'))
  const seenBrands = new Set<string>()
  const selected: typeof withImages = []
  for (const c of withImages) {
    if (selected.length >= count) break
    if (seenBrands.has(c.brand)) continue
    seenBrands.add(c.brand)
    selected.push(c)
  }
  const results: Array<{ brand: string; name: string; base64: string }> = []
  for (const c of selected) {
    const base64 = await fetchImageAsBase64(c.imageUrl!)
    if (base64) results.push({ brand: c.brand, name: c.name, base64 })
  }
  referenceImagesCache = { images: results, fetchedAt: Date.now() }
  return results
}

/**
 * Compress a base64 image to reduce size for API calls
 * Groq has a limit on request size, so we need to compress large images
 */
export function compressBase64Image(base64Image: string, maxSizeKB: number = 500): string {
  // Extract the base64 data and mime type
  const matches = base64Image.match(/^data:([^;]+);base64,(.+)$/)
  if (!matches) return base64Image
  
  const mimeType = matches[1]
  const base64Data = matches[2]
  
  // Calculate current size in KB
  const currentSizeKB = (base64Data.length * 3) / 4 / 1024
  
  console.log(`[ImageUtils] Original image size: ${Math.round(currentSizeKB)}KB`)
  
  // If already under the limit, return as-is
  if (currentSizeKB <= maxSizeKB) {
    console.log(`[ImageUtils] Image is under ${maxSizeKB}KB, no compression needed`)
    return base64Image
  }
  
  // For server-side, we can't use canvas, so we'll do a simple quality reduction
  // by reducing the base64 string length (this is a rough approximation)
  // In a real app, you'd want to use sharp or another image processing library
  
  console.log(`[ImageUtils] Image is ${Math.round(currentSizeKB)}KB, needs compression`)
  
  // Return original for now - the caller should handle the 413 error
  // To properly compress, you'd need to install 'sharp' package
  return base64Image
}

/**
 * Resize base64 image using sharp (if available)
 * This provides proper image compression
 */
export async function resizeBase64Image(
  base64Image: string, 
  maxWidth: number = 1024, 
  maxHeight: number = 1024,
  quality: number = 80
): Promise<string> {
  try {
    // Dynamic import of sharp
    const sharp = require('sharp')
    
    // Extract the base64 data
    const matches = base64Image.match(/^data:([^;]+);base64,(.+)$/)
    if (!matches) return base64Image
    
    const mimeType = matches[1]
    const base64Data = matches[2]
    const buffer = Buffer.from(base64Data, 'base64')
    
    const originalSizeKB = Math.round(buffer.length / 1024)
    console.log(`[ImageUtils] Original size: ${originalSizeKB}KB`)
    
    // Resize and compress
    let processedBuffer: Buffer
    
    if (mimeType.includes('png')) {
      processedBuffer = await sharp(buffer)
        .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
        .png({ quality, compressionLevel: 9 })
        .toBuffer()
    } else {
      processedBuffer = await sharp(buffer)
        .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality })
        .toBuffer()
    }
    
    const newSizeKB = Math.round(processedBuffer.length / 1024)
    console.log(`[ImageUtils] Compressed size: ${newSizeKB}KB (${Math.round((1 - newSizeKB/originalSizeKB) * 100)}% reduction)`)
    
    const newBase64 = processedBuffer.toString('base64')
    const outputMime = mimeType.includes('png') ? 'image/png' : 'image/jpeg'
    
    return `data:${outputMime};base64,${newBase64}`
  } catch (error) {
    // Sharp not available, return original
    console.log('[ImageUtils] Sharp not available, returning original image')
    return base64Image
  }
}

/**
 * Check if image is too large for API
 */
export function isImageTooLarge(base64Image: string, maxSizeKB: number = 1000): boolean {
  const matches = base64Image.match(/^data:[^;]+;base64,(.+)$/)
  if (!matches) return false
  
  const sizeKB = (matches[1].length * 3) / 4 / 1024
  return sizeKB > maxSizeKB
}

/**
 * Get image size in KB
 */
export function getImageSizeKB(base64Image: string): number {
  const matches = base64Image.match(/^data:[^;]+;base64,(.+)$/)
  if (!matches) return 0
  
  return Math.round((matches[1].length * 3) / 4 / 1024)
}
