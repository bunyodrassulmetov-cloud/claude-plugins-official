import 'server-only';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from './db';
import { config } from './config';
import { SESSION_COOKIE, signSession, verifySession } from './jwt';

export type SessionUser = {
  id: number;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'DIRECTOR' | 'CHIEF_ACCOUNTANT' | 'ACCOUNTANT';
  departmentId: number | null;
  departmentName: string | null;
  managerId: number | null;
};

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createSessionCookie(user: { id: number; email: string; role: string; fullName: string }) {
  const token = await signSession(
    { sub: String(user.id), email: user.email, role: user.role, fullName: user.fullName },
    config.sessionTtlHours,
  );
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
    maxAge: config.sessionTtlHours * 3600,
  });
}

export async function destroySessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Пользователь текущей сессии либо null. Роль читается из БД, а не из токена:
 *  админ мог изменить роль или отключить учётку после выдачи токена. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
    include: { department: { select: { name: true } } },
  });
  if (!user || !user.isActive || user.approvalStatus !== 'APPROVED') return null;

  // Пароль сменили — все токены, выданные раньше, недействительны.
  // Секунда допуска: iat округляется вниз, иначе свежий токен отверг бы сам себя.
  if (payload.issuedAt && payload.issuedAt + 1 < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    departmentId: user.departmentId,
    departmentName: user.department?.name ?? null,
    managerId: user.managerId,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, 'Требуется вход в систему');
  return user;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
