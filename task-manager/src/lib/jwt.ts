import { SignJWT, jwtVerify } from 'jose';

/** Только jose — файл импортируется из middleware (edge runtime). */
export const SESSION_COOKIE = 'tm_session';

export type SessionPayload = {
  sub: string;
  email: string;
  role: string;
  fullName: string;
  /** Момент выпуска токена (сек). Нужен, чтобы отозвать сессии при смене пароля. */
  issuedAt?: number;
};

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET не задан или слишком короткий (нужно ≥16 символов)');
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload, ttlHours: number) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttlHours}h`)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ''),
      role: String(payload.role ?? ''),
      fullName: String(payload.fullName ?? ''),
      issuedAt: typeof payload.iat === 'number' ? payload.iat : undefined,
    };
  } catch {
    return null;
  }
}
