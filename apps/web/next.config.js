/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow streaming server images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  // CORS for stream URLs proxied through Vercel
  async rewrites() {
    const streamingBase = process.env.STREAMING_BASE_URL;
    if (!streamingBase) return [];

    return [
      // Optional: proxy stream health checks to avoid CORS issues
      {
        source: '/stream-health',
        destination: `${streamingBase}/status-json.xsl`,
      },
    ];
  },
};

module.exports = nextConfig;
