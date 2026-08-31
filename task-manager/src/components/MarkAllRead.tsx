'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function MarkAllRead() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function markAll() {
    setPending(true);
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <button className="btn-secondary" type="button" onClick={markAll} disabled={pending}>
      {pending ? 'Отмечаю…' : 'Отметить всё прочитанным'}
    </button>
  );
}
