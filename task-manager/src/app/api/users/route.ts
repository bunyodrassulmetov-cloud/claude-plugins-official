import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, hashPassword, requireUser } from '@/lib/auth';
import { fail, handle, ok } from '@/lib/api';
import { assignableUserIds, canManageUsers } from '@/lib/permissions';
import { parseBody, userCreateSchema } from '@/lib/validation';

const publicSelect = {
  id: true,
  email: true,
  fullName: true,
  position: true,
  role: true,
  departmentId: true,
  managerId: true,
  isActive: true,
  department: { select: { id: true, name: true } },
} as const;

/** ?assignable=1 — только те, кому текущий пользователь вправе ставить задачи. */
export async function GET(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    if (request.nextUrl.searchParams.get('assignable') === '1') {
      const allowed = await assignableUserIds(user);
      const users = await prisma.user.findMany({
        where: { isActive: true, ...(allowed === 'ALL' ? {} : { id: { in: allowed } }) },
        select: publicSelect,
        orderBy: { fullName: 'asc' },
      });
      return ok(users);
    }
    const users = await prisma.user.findMany({
      where: canManageUsers(user) ? {} : { isActive: true },
      select: publicSelect,
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
    });
    return ok(users);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    if (!canManageUsers(user)) throw new HttpError(403, 'Создавать пользователей может только администратор');

    const { data, error } = parseBody(userCreateSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);

    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) return fail('Пользователь с таким email уже существует', 409);

    const created = await prisma.user.create({
      data: {
        email: data.email,
        fullName: data.fullName,
        position: data.position ?? null,
        role: data.role,
        departmentId: data.departmentId ?? null,
        managerId: data.managerId ?? null,
        passwordHash: await hashPassword(data.password),
      },
      select: publicSelect,
    });
    return ok(created, 201);
  });
}
