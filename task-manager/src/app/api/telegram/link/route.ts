import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handle, ok } from '@/lib/api';
import { issueLinkCode } from '@/lib/telegram';

/** Выдать одноразовый код привязки для текущего сотрудника. */
export async function POST() {
  return handle(async () => {
    const user = await requireUser();
    return ok({ code: await issueLinkCode(user.id) });
  });
}

/** Отвязать чат. */
export async function DELETE() {
  return handle(async () => {
    const user = await requireUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { telegramChatId: null, telegramLinkCode: null },
    });
    return ok({ success: true });
  });
}
