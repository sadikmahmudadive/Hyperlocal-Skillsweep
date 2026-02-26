/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    domains: ['res.cloudinary.com', 'images.unsplash.com'],
  },
  // Temporarily ignore ESLint errors during build to avoid failing production
  // builds while we incrementally fix react-hooks/exhaustive-deps and other
  // warnings. Remove or set to false after addressing lint issues.
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY || '',
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://api.mapbox.com https://*.tiles.mapbox.com https://*.stripe.com",
      "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
      `script-src 'self' 'unsafe-inline' https://api.mapbox.com https://js.stripe.com https://vercel.live https://*.vercel.live${isDev ? " 'unsafe-eval'" : ''}`,
      "connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://api.stripe.com https://*.stripe.com",
      "font-src 'self' data: https://api.mapbox.com",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
      "manifest-src 'self'",
      ...(isDev ? [] : ["upgrade-insecure-requests"]),
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