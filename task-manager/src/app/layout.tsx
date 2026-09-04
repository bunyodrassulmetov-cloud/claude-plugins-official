import type { Metadata, Viewport } from 'next';
import './globals.css';
import { config } from '@/lib/config';

export const metadata: Metadata = {
  title: `Task Manager — ${config.companyName}`,
  description: 'Внутренний менеджер задач: постановка, контроль сроков и ежедневные отчёты',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
