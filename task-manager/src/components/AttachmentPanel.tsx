'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ALLOWED_EXTENSIONS, formatBytes } from '@/lib/attachments';

export type AttachmentView = {
  id: number;
  originalName: string;
  sizeBytes: number;
  uploadedBy: { fullName: string };
  createdAt: string;
};

export default function AttachmentPanel({
  taskId,
  attachments,
  canUpload,
  maxMb,
}: {
  taskId: number;
  attachments: AttachmentView[];
  canUpload: boolean;
  maxMb: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setPending(true);
    setError(null);
    const form = new FormData();
    Array.from(fileList).forEach((file) => form.append('files', file));
    const response = await fetch(`/api/tasks/${taskId}/attachments`, { method: 'POST', body: form });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось загрузить файл');
      return;
    }
    router.refresh();
  }

  async function remove(id: number) {
    if (!window.confirm('Удалить вложение?')) return;
    const response = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось удалить вложение');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {attachments.length === 0 ? (
        <p className="text-sm text-slate-400">Вложений нет.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {attachments.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-3 py-2">
              <a
                className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 hover:underline"
                href={`/api/attachments/${file.id}`}
              >
                📎 {file.originalName}
              </a>
              <span className="shrink-0 text-xs text-slate-400">
                {formatBytes(file.sizeBytes)} · {file.uploadedBy.fullName}
              </span>
              {canUpload ? (
                <button
                  type="button"
                  className="shrink-0 text-xs text-red-500 hover:underline"
                  onClick={() => remove(file.id)}
                >
                  удалить
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canUpload ? (
        <div>
          <input
            type="file"
            multiple
            className="input"
            accept={ALLOWED_EXTENSIONS.join(',')}
            disabled={pending}
            onChange={(e) => upload(e.target.files)}
          />
          <p className="mt-1 text-xs text-slate-400">
            {ALLOWED_EXTENSIONS.join(', ')} · до {maxMb} МБ на файл
          </p>
        </div>
      ) : null}

      {pending ? <p className="text-sm text-slate-500">Загрузка…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
