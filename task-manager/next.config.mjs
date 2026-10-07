/** @type {import('next').NextConfig} */

/**
 * Заголовки безопасности. CSP оставляет 'unsafe-inline' для скриптов:
 * Next вставляет служебные inline-скрипты, без нонсов иначе ломается гидратация.
 * Даже в таком виде она отсекает загрузку стороннего кода и встраивание в чужие фреймы.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // X-Frame-Options здесь нет намеренно: он умеет только «всем нельзя» и перекрыл бы
  // мини-приложение Telegram. Ограничение задаётся через frame-ancestors ниже — оно точнее.
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // telegram.org — библиотека мини-приложения
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // Telegram открывает мини-приложение во фрейме на вебе и в десктоп-клиенте
      "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
    ].join('; '),
  },
];

const nextConfig = {
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'write-excel-file'],
  experimental: {
    serverActions: { bodySizeLimit: '25mb' },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
