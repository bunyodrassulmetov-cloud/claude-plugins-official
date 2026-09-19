import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from './db';

const TTL_MINUTES = 60;

/** В базе храним только хэш: по содержимому таблицы ссылку восстановить нельзя. */
function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function issueResetToken(userId: number) {
  const token = randomBytes(32).toString('hex');
  // Прежние ссылки этого человека гасим: действует только последняя
  await prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000),
    },
  });
  return { token, ttlMinutes: TTL_MINUTES };
}

export async function consumeResetToken(token: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: true },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;
  if (!record.user.isActive || record.user.approvalStatus !== 'APPROVED') return null;

  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return record.user;
}
