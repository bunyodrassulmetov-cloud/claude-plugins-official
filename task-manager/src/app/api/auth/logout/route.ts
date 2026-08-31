import { destroySessionCookie } from '@/lib/auth';
import { handle, ok } from '@/lib/api';

export async function POST() {
  return handle(async () => {
    await destroySessionCookie();
    return ok({ success: true });
  });
}
