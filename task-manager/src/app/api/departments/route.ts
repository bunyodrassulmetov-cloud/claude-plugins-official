import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, requireUser } from '@/lib/auth';
import { fail, handle, ok } from '@/lib/api';
import { canManageDepartments } from '@/lib/permissions';
import { departmentSchema, parseBody } from '@/lib/validation';

export async function GET() {
  return handle(async () => {
    await requireUser();
    const departments = await prisma.department.findMany({
      include: {
        head: { select: { id: true, fullName: true } },
        _count: { select: { members: true } },
      },
      orderBy: { name: 'asc' },
    });
    return ok(departments);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    if (!canManageDepartments(user)) throw new HttpError(403, 'Недостаточно прав');
    const { data, error } = parseBody(departmentSchema, await request.json());
    if (!data) return fail(error ?? 'Некорректные данные', 422);
    const created = await prisma.department.create({
      data: { name: data.name, headId: data.headId ?? null },
    });
    return ok(created, 201);
  });
}

export async function PATCH(request: NextRequest) {
  return handle(async () => {
    const user = await requireUser();
    if (!canManageDepartments(user)) throw new HttpError(403, 'Недостаточно прав');
    const body = (await request.json()) as { id?: number };
    if (!body.id) return fail('Не указан отдел', 422);
    const { data, error } = parseBody(departmentSchema.partial(), body);
    if (!data) return fail(error ?? 'Некорректные данные', 422);
    const updated = await prisma.department.update({
      where: { id: Number(body.id) },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.headId !== undefined ? { headId: data.headId || null } : {}),
      },
    });
    return ok(updated);
  });
}
