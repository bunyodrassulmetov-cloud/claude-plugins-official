'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NoteComposer({ taskId }: { taskId: number }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setError(null);
    const response = await fetch(`/api/tasks/${taskId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось сохранить заметку');
      return;
    }
    setBody('');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        className="input min-h-20"
        placeholder="Добавить заметку по ходу выполнения…"
        maxLength={5000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button className="btn-primary" type="submit" disabled={pending || !body.trim()}>
        {pending ? 'Сохранение…' : 'Добавить заметку'}
      </button>
    </form>
  );
}
