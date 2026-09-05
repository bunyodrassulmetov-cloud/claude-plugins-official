import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/jwt';

/**
 * Быстрая отсечка неавторизованных запросов на границе.
 * Права ролей проверяются на сервере в обработчиках — здесь только наличие валидной сессии.
 */
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  const { pathname } = request.nextUrl;

  if (pathname === '/login' || pathname === '/register') {
    if (!session) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (!session) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Требуется вход в систему' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/company/:path*',
    '/templates/:path*',
    '/tasks/:path*',
    '/reports/:path*',
    '/notifications/:path*',
    '/profile/:path*',
    '/admin/:path*',
    '/login',
    '/register',
    '/api/tasks/:path*',
    '/api/reports/:path*',
    '/api/users/:path*',
    '/api/departments/:path*',
    '/api/notifications/:path*',
    '/api/attachments/:path*',
    '/api/checklist/:path*',
    '/api/templates/:path*',
    '/api/telegram/link',
    '/api/auth/password',
    '/api/settings',
  ],
};
