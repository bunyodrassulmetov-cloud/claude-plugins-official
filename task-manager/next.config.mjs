/** @type {import('next').NextConfig} */

/**
 * Заголовки безопасности. CSP оставляет 'unsafe-inline' для скриптов:
 * Next вставляет служебные inline-скрипты, без нонсов иначе ломается гидратация.
 * Даже в таком виде она отсекает загрузку стороннего кода и встраивание в чужие фреймы.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig = {
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  experimental: {
    serverActions: { bodySizeLimit: '25mb' },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
