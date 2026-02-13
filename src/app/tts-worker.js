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

      const selectedVoice = voice || 'af_heart' // warm, high-quality female voice
      const result = await engine.generate(text, { voice: selectedVoice })

      // RawAudio has .audio (Float32Array) and .sampling_rate (number)
      const samples = result.audio
      const sampleRate = result.sampling_rate

      self.postMessage(
        {
          type: 'audio',
          id,
          samples: samples.buffer,
          sampleRate,
        },
        [samples.buffer] // transfer ownership for zero-copy
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
