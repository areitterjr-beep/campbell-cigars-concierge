import { KokoroTTS } from 'kokoro-js'

// Singleton: load model once and reuse
let tts = null
let loading = false

async function getInstance() {
  if (tts) return tts
  if (loading) {
    // Wait for in-progress load
    while (loading) await new Promise((r) => setTimeout(r, 100))
    return tts
  }
  loading = true
  self.postMessage({ type: 'status', status: 'loading' })

  try {
    tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',   // good quality / ~35MB download
      device: 'wasm', // broadest browser support
    })
    self.postMessage({ type: 'status', status: 'ready' })
  } catch (err) {
    self.postMessage({ type: 'status', status: 'error', error: err.message })
    loading = false
    throw err
  }
  loading = false
  return tts
}

// Extract PCM Float32Array and sample rate from whatever generate() returns
function extractAudio(result) {
  // Try every known property name for the audio samples
  const pcm = result.audio      // RawAudio from @huggingface/transformers
            || result.data       // some versions use .data
            || result.waveform   // alternate name
            || result             // generate() might return Float32Array directly

  // If pcm is a typed array, use it directly
  if (pcm instanceof Float32Array) {
    return { samples: pcm, sampleRate: result.sampling_rate || 24000 }
  }

  // If pcm is an object with its own .audio or .data
  if (pcm && pcm.audio instanceof Float32Array) {
    return { samples: pcm.audio, sampleRate: pcm.sampling_rate || 24000 }
  }
  if (pcm && pcm.data instanceof Float32Array) {
    return { samples: pcm.data, sampleRate: pcm.sampling_rate || 24000 }
  }

  // Last resort: try toWav() if available and extract from WAV
  if (result && typeof result.toBlob === 'function') {
    // Can't easily decode a blob in a worker, so report the shape for debugging
    throw new Error(`Unrecognized audio format. Keys: ${Object.keys(result).join(', ')}. ` +
      `Prototype: ${Object.getPrototypeOf(result)?.constructor?.name}`)
  }

  throw new Error(`Cannot extract audio. Type: ${typeof result}. ` +
    `Keys: ${result ? Object.keys(result).join(', ') : 'N/A'}`)
}

self.addEventListener('message', async (e) => {
  const { type, text, id, voice } = e.data

  if (type === 'generate') {
    try {
      const engine = await getInstance()

      // Preload call sends empty text — just load the model, don't generate
      if (!text || !text.trim()) {
        self.postMessage({ type: 'audio', id, samples: new ArrayBuffer(0), sampleRate: 24000 })
        return
      }

      const selectedVoice = voice || 'af_heart'
      const result = await engine.generate(text, { voice: selectedVoice })

      const { samples, sampleRate } = extractAudio(result)

      self.postMessage(
        {
          type: 'audio',
          id,
          samples: samples.buffer,
          sampleRate,
        },
        [samples.buffer]
      )
    } catch (err) {
      self.postMessage({ type: 'error', id, error: err.message })
    }
  }

  if (type === 'voices') {
    try {
      const engine = await getInstance()
      const voices = engine.list_voices()
      self.postMessage({ type: 'voices', voices })
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message })
    }
  }
})
