/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['res.cloudinary.com', 'images.unsplash.com'],
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://api.mapbox.com https://*.tiles.mapbox.com",
      "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://api.mapbox.com",
      "connect-src 'self' https://api.mapbox.com https://events.mapbox.com",
      "font-src 'self' data: https://api.mapbox.com",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "frame-ancestors 'self'",
      // Mapbox tiles/styles
      "manifest-src 'self'",
    ].join('; ');
    const headers = [
      { key: 'Content-Security-Policy', value: csp },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'Permissions-Policy', value: 'geolocation=(self), microphone=(), camera=()' },
      { key: 'X-XSS-Protection', value: '0' },
    ];
    return [
      { source: '/(.*)', headers },
    ];
  }
}

module.exports = nextConfig