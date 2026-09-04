import type { MetadataRoute } from 'next';
import { config } from '@/lib/config';

/** Манифест PWA: приложение можно добавить на главный экран телефона. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `Task Manager — ${config.companyName}`,
    short_name: 'Task Manager',
    description: 'Задачи, сроки и ежедневные отчёты',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f1f5f9',
    theme_color: '#0f172a',
    lang: 'ru',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
