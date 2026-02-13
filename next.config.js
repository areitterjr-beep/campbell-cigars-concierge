/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Turbopack config (Next.js 16 default bundler) — ignore Node-only ONNX/sharp modules
  turbopack: {
    resolveAlias: {
      'sharp$': { browser: '' },
      'onnxruntime-node$': { browser: '' },
    },
  },
  // Webpack fallback (for older builds or explicit --webpack flag)
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'sharp$': false,
      'onnxruntime-node$': false,
    }
    return config
  },
}

module.exports = nextConfig
