import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? (user.role === 'ADMIN' ? '/admin/users' : '/dashboard') : '/login');
}
