'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ReportRefresh({ period }: { period: 'DAILY' | 'WEEKLY' | 'MONTHLY' }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setPending(true);
    setError(null);
    const response = await fetch('/api/reports/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period }),
    });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось сформировать отчёт');
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button className="btn-secondary" type="button" onClick={generate} disabled={pending}>
        {pending ? 'Формирую…' : 'Пересчитать сейчас'}
      </button>
      {error ? <span className="text-sm text-red-600">{error}</span> : null}
    </div>
  );
}
