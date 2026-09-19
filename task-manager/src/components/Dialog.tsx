'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Диалог подтверждения вместо window.confirm/prompt.
 * Встроенные диалоги браузера блокируются во встроенных браузерах (например,
 * при открытии ссылки из Telegram) — кнопка нажимается, но ничего не происходит.
 */
export default function Dialog({
  open,
  title,
  description,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  tone = 'default',
  input,
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger' | 'success';
  /** Если задано — в диалоге появится поле ввода, его значение придёт в onConfirm. */
  input?: { label: string; placeholder?: string; required?: boolean; multiline?: boolean };
  pending?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const fieldRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue('');
      // Небольшая задержка: поле появляется вместе с диалогом
      const timer = setTimeout(() => fieldRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  if (!open) return null;

  const confirmClass =
    tone === 'danger' ? 'btn-danger' : tone === 'success' ? 'btn-success' : 'btn-primary';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>

        {input ? (
          <div>
            <label className="label" htmlFor="dialog-input">
              {input.label}
            </label>
            {input.multiline === false ? (
              <input
                id="dialog-input"
                ref={fieldRef as React.RefObject<HTMLInputElement>}
                className="input"
                placeholder={input.placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            ) : (
              <textarea
                id="dialog-input"
                ref={fieldRef as React.RefObject<HTMLTextAreaElement>}
                className="input min-h-24"
                placeholder={input.placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary min-h-11" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${confirmClass} min-h-11`}
            disabled={pending || (input?.required === true && !value.trim())}
            onClick={() => onConfirm(value)}
          >
            {pending ? 'Выполняется…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
