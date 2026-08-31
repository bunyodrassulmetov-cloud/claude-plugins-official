import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handle, ok } from '@/lib/api';

export async function GET(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const unreadOnly = request.nextUrl.searchParams.get('unread') === '1';
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id, ...(unreadOnly ? { isRead: false } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    ]);
    return ok({ items, unread });
  });
}

/** Отметить прочитанными: конкретные id либо все. */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    const body = (await request.json().catch(() => ({}))) as { ids?: number[] };
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        ...(Array.isArray(body.ids) && body.ids.length > 0 ? { id: { in: body.ids } } : {}),
      },
      data: { isRead: true },
    });
    return ok({ success: true });
  });
}
