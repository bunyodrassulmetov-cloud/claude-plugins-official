import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { telegramBotName, telegramEnabled } from '@/lib/telegram';
import { ROLE_LABELS } from '@/lib/permissions';
import PasswordChangeForm from '@/components/PasswordChangeForm';
import TelegramLink from '@/components/TelegramLink';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Профиль — Task Manager' };

export default async function ProfilePage() {
  const user = await requireUser();
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { telegramChatId: true },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Профиль</h1>
        <p className="text-sm text-slate-500">
          {user.fullName} · {ROLE_LABELS[user.role]}
          {user.departmentName ? ` · ${user.departmentName}` : ''}
        </p>
      </div>

      {telegramEnabled() ? (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
            Уведомления в Telegram
          </h2>
          <TelegramLink connected={Boolean(account.telegramChatId)} botName={telegramBotName()} />
        </div>
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
          Смена пароля
        </h2>
        <PasswordChangeForm />
      </div>
    </div>
  );
}
