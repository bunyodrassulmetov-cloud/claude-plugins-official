'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { fromZonedTime } from 'date-fns-tz';
import { ALLOWED_EXTENSIONS } from '@/lib/attachments';

export type PersonOption = { id: number; fullName: string; position?: string | null };

export type TaskFormValues = {
  id?: number;
  title: string;
  description: string;
  assigneeId: number | '';
  customerId: number | '';
  acceptorId: number | '';
  coAssigneeIds: number[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  deadline: string; // значение datetime-local
};

/**
 * Форма в два уровня: сверху минимум для быстрой постановки задачи
 * (название, исполнитель, срок, приоритет), остальное — под кнопкой «Подробнее».
 * При редактировании подробности раскрыты сразу: там уже есть что показывать.
 */
export default function TaskForm({
  mode,
  initial,
  assignees,
  people,
  timezone,
  canChangeAssignee = true,
}: {
  mode: 'create' | 'edit';
  initial: TaskFormValues;
  assignees: PersonOption[];
  people: PersonOption[];
  /** Рабочий часовой пояс: введённое время трактуется в нём, а не в зоне браузера. */
  timezone: string;
  canChangeAssignee?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<TaskFormValues>(initial);
  const [detailed, setDetailed] = useState(mode === 'edit');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function set<K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const customerName = people.find((person) => person.id === Number(values.customerId))?.fullName;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const payload = {
      title: values.title,
      description: values.description || null,
      assigneeId: Number(values.assigneeId),
      customerId: Number(values.customerId),
      acceptorId: values.acceptorId ? Number(values.acceptorId) : null,
      coAssigneeIds: values.coAssigneeIds,
      priority: values.priority,
      // datetime-local не содержит зоны — трактуем ввод в рабочем часовом поясе компании
      deadline: fromZonedTime(values.deadline, timezone).toISOString(),
      ...(mode === 'create' && note.trim() ? { note: note.trim() } : {}),
    };

    const response = await fetch(mode === 'create' ? '/api/tasks' : `/api/tasks/${values.id}`, {
      method: mode === 'create' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setPending(false);
      setError(result.error ?? 'Не удалось сохранить задачу');
      return;
    }

    const taskId = result.id ?? values.id;
    if (files && files.length > 0) {
      const form = new FormData();
      Array.from(files).forEach((file) => form.append('files', file));
      const upload = await fetch(`/api/tasks/${taskId}/attachments`, { method: 'POST', body: form });
      if (!upload.ok) {
        const uploadError = await upload.json().catch(() => ({}));
        setPending(false);
        setError(`Задача сохранена, но файлы не загружены: ${uploadError.error ?? 'ошибка загрузки'}`);
        router.refresh();
        return;
      }
    }

    router.push(`/tasks/${taskId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-5">
      <div>
        <label className="label" htmlFor="title">
          Что нужно сделать *
        </label>
        <input
          id="title"
          className="input"
          required
          minLength={3}
          maxLength={200}
          autoFocus={mode === 'create'}
          placeholder="Например: сдать декларацию по НДС"
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="assigneeId">
            Исполнитель *
          </label>
          <select
            id="assigneeId"
            className="input"
            required
            disabled={!canChangeAssignee}
            value={values.assigneeId}
            onChange={(e) => set('assigneeId', Number(e.target.value))}
          >
            <option value="">— выберите —</option>
            {assignees.map((person) => (
              <option key={person.id} value={person.id}>
                {person.fullName}
                {person.position ? ` · ${person.position}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="deadline">
            Срок *
          </label>
          <input
            id="deadline"
            type="datetime-local"
            className="input"
            required
            value={values.deadline}
            onChange={(e) => set('deadline', e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="priority">
            Приоритет
          </label>
          <select
            id="priority"
            className="input"
            value={values.priority}
            onChange={(e) => set('priority', e.target.value as TaskFormValues['priority'])}
          >
            <option value="LOW">Низкий</option>
            <option value="MEDIUM">Средний</option>
            <option value="HIGH">Высокий</option>
            <option value="CRITICAL">Критичный</option>
          </select>
        </div>
      </div>

      {mode === 'create' && !detailed ? (
        <p className="text-xs text-slate-400">
          Заказчик — {customerName ?? 'вы'}. Приёмка не требуется, задача закроется отметкой
          исполнителя. Всё это можно изменить в подробностях.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setDetailed((v) => !v)}
        aria-expanded={detailed}
        className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <span className={`transition-transform ${detailed ? 'rotate-90' : ''}`}>▶</span>
        {detailed ? 'Свернуть подробности' : 'Подробнее: описание, заказчик, приёмка, со-исполнители, файлы'}
      </button>

      {detailed ? (
        <div className="space-y-4 border-t border-slate-100 pt-4">
          <div>
            <label className="label" htmlFor="description">
              Описание
            </label>
            <textarea
              id="description"
              className="input min-h-24"
              maxLength={5000}
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="customerId">
                Заказчик *
              </label>
              <select
                id="customerId"
                className="input"
                required
                value={values.customerId}
                onChange={(e) => set('customerId', Number(e.target.value))}
              >
                <option value="">— выберите —</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">Кто поставил задачу.</p>
            </div>

            <div>
              <label className="label" htmlFor="acceptorId">
                Принимающий
              </label>
              <select
                id="acceptorId"
                className="input"
                value={values.acceptorId}
                onChange={(e) => set('acceptorId', e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Без приёмки</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Если указан — задача закроется только после его подтверждения.
              </p>
            </div>
          </div>

          <div>
            <span className="label">Со-исполнители</span>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-300 bg-white p-2">
              <div className="grid gap-1 sm:grid-cols-2">
                {people
                  .filter((person) => person.id !== Number(values.assigneeId))
                  .map((person) => (
                    <label key={person.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                        checked={values.coAssigneeIds.includes(person.id)}
                        onChange={(e) =>
                          set(
                            'coAssigneeIds',
                            e.target.checked
                              ? [...values.coAssigneeIds, person.id]
                              : values.coAssigneeIds.filter((id) => id !== person.id),
                          )
                        }
                      />
                      {person.fullName}
                    </label>
                  ))}
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Помогают основному исполнителю: видят задачу, ведут чек-лист и могут отметить выполнение.
              В отчёте задача считается за основным исполнителем.
            </p>
          </div>

          {mode === 'create' ? (
            <>
              <div>
                <label className="label" htmlFor="note">
                  Первая заметка
                </label>
                <textarea
                  id="note"
                  className="input"
                  maxLength={5000}
                  placeholder="Например: реквизиты, ссылки, что уже сделано"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="files">
                  Вложения
                </label>
                <input
                  id="files"
                  type="file"
                  multiple
                  className="input"
                  accept={ALLOWED_EXTENSIONS.join(',')}
                  onChange={(e) => setFiles(e.target.files)}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Допустимые форматы: {ALLOWED_EXTENSIONS.join(', ')}.
                </p>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {!canChangeAssignee ? (
        <p className="text-xs text-slate-400">Вы можете ставить задачи только себе.</p>
      ) : null}

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? 'Сохранение…' : mode === 'create' ? 'Создать задачу' : 'Сохранить'}
        </button>
        <button className="btn-secondary" type="button" onClick={() => router.back()}>
          Отмена
        </button>
      </div>
    </form>
  );
}
