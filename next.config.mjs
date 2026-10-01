if (process.env.VERCEL_ENV === 'preview' && process.env.APIMODELS_API_KEY) {
  try {
    const r = await fetch('https://api.apimodels.app/v1/balance', {
      headers: { Authorization: `Bearer ${process.env.APIMODELS_API_KEY}` },
    })
    const body = await r.text()
    console.log('[APIMODELS_BALANCE_CHECK]', r.status, body)
  } catch (error) {
    console.log('[APIMODELS_BALANCE_CHECK_ERROR]', error instanceof Error ? error.message : String(error))
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
