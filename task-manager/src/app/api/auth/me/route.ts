import { getCurrentUser } from '@/lib/auth';
import { fail, handle, ok } from '@/lib/api';

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return fail('Требуется вход в систему', 401);
    return ok(user);
  });
}
