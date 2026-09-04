'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Recurrence } from '@prisma/client';
import { PRIORITY_LABELS } from './ui';

export type TemplateRow = {
  id: number;
  title: string;
  assignee: string;
  customer: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  schedule: string;
  checklistCount: number;
  leadDays: number;
  isActive: boolean;
};

export type Person = { id: number; fullName: string };

const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: 'DAILY', label: 'Каждый день' },
  { value: 'WEEKLY', label: 'Каждую неделю' },
  { value: 'MONTHLY', label: 'Каждый месяц' },
  { value: 'QUARTERLY', label: 'Раз в квартал' },
];

const WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];

export default function TemplateManager({
  templates,
  people,
  currentUserId,
}: {
  templates: TemplateRow[];
  people: Person[];
  currentUserId: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    assigneeId: String(currentUserId),
    customerId: String(currentUserId),
    acceptorId: '',
    priority: 'MEDIUM',
    recurrence: 'MONTHLY' as Recurrence,
    dayOfWeek: '1',
    dayOfMonth: '1',
    dueHour: '18',
    dueMinute: '0',
    leadDays: '0',
    checklist: '',
  });

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        assigneeId: Number(form.assigneeId),
        customerId: Number(form.customerId),
        acceptorId: form.acceptorId ? Number(form.acceptorId) : null,
        priority: form.priority,
        recurrence: form.recurrence,
        dayOfWeek: form.recurrence === 'WEEKLY' ? Number(form.dayOfWeek) : null,
        dayOfMonth:
          form.recurrence === 'MONTHLY' || form.recurrence === 'QUARTERLY'
            ? Number(form.dayOfMonth)
            : null,
        dueHour: Number(form.dueHour),
        dueMinute: Number(form.dueMinute),
        leadDays: Number(form.leadDays),
        checklist: form.checklist
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      }),
    });
    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось создать шаблон');
      return;
    }
    setForm({ ...form, title: '', description: '', checklist: '' });
    setOpen(false);
    router.refresh();
  }

  async function patch(id: number, data: Record<string, unknown>) {
    const response = await fetch(`/api/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось изменить шаблон');
      return;
    }
    router.refresh();
  }

  async function remove(id: number) {
    if (!window.confirm('Удалить шаблон? Уже созданные задачи останутся.')) return;
    const response = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? 'Не удалось удалить шаблон');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {!open ? (
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          + Новый шаблон
        </button>
      ) : (
        <form onSubmit={create} className="card space-y-4 p-5">
          <div>
            <label className="label" htmlFor="t-title">
              Название задачи *
            </label>
            <input
              id="t-title"
              className="input"
              required
              minLength={3}
              placeholder="Например: сдать декларацию по НДС"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="t-assignee">
                Исполнитель *
              </label>
              <select
                id="t-assignee"
                className="input"
                value={form.assigneeId}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
              >
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="t-recurrence">
                Повторять
              </label>
              <select
                id="t-recurrence"
                className="input"
                value={form.recurrence}
                onChange={(e) => setForm({ ...form, recurrence: e.target.value as Recurrence })}
              >
                {RECURRENCES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {form.recurrence === 'WEEKLY' ? (
              <div>
                <label className="label" htmlFor="t-dow">
                  День недели
                </label>
                <select
                  id="t-dow"
                  className="input"
                  value={form.dayOfWeek}
                  onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
                >
                  {WEEKDAYS.map((day, index) => (
                    <option key={day} value={index + 1}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            ) : form.recurrence === 'DAILY' ? (
              <div />
            ) : (
              <div>
                <label className="label" htmlFor="t-dom">
                  Число месяца
                </label>
                <input
                  id="t-dom"
                  type="number"
                  min={1}
                  max={28}
                  className="input"
                  value={form.dayOfMonth}
                  onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
                />
                <p className="mt-1 text-xs text-slate-400">До 28-го: иначе в феврале срок терялся бы.</p>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="label" htmlFor="t-hour">
                Час срока
              </label>
              <input
                id="t-hour"
                type="number"
                min={0}
                max={23}
                className="input"
                value={form.dueHour}
                onChange={(e) => setForm({ ...form, dueHour: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="t-minute">
                Минуты
              </label>
              <input
                id="t-minute"
                type="number"
                min={0}
                max={59}
                className="input"
                value={form.dueMinute}
                onChange={(e) => setForm({ ...form, dueMinute: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="t-lead">
                Создавать за (дней)
              </label>
              <input
                id="t-lead"
                type="number"
                min={0}
                max={30}
                className="input"
                value={form.leadDays}
                onChange={(e) => setForm({ ...form, leadDays: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-400">0 — в день срока.</p>
            </div>
            <div>
              <label className="label" htmlFor="t-priority">
                Приоритет
              </label>
              <select
                id="t-priority"
                className="input"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((value) => (
                  <option key={value} value={value}>
                    {PRIORITY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="t-acceptor">
                Принимающий
              </label>
              <select
                id="t-acceptor"
                className="input"
                value={form.acceptorId}
                onChange={(e) => setForm({ ...form, acceptorId: e.target.value })}
              >
                <option value="">Без приёмки</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="t-customer">
                Заказчик
              </label>
              <select
                id="t-customer"
                className="input"
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              >
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="t-checklist">
              Чек-лист — по пункту на строку
            </label>
            <textarea
              id="t-checklist"
              className="input min-h-24"
              placeholder={'Свести книгу покупок\nПроверить контрольные соотношения\nОтправить в налоговую'}
              value={form.checklist}
              onChange={(e) => setForm({ ...form, checklist: e.target.value })}
            />
          </div>

          <div>
            <label className="label" htmlFor="t-description">
              Описание
            </label>
            <textarea
              id="t-description"
              className="input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          <div className="flex gap-2">
            <button className="btn-primary" type="submit" disabled={pending}>
              {pending ? 'Создание…' : 'Создать шаблон'}
            </button>
            <button className="btn-secondary" type="button" onClick={() => setOpen(false)}>
              Отмена
            </button>
          </div>
        </form>
      )}

      {error && !open ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {templates.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          Шаблонов пока нет. Заведите повторяющиеся дела — НДС, зарплату, кассовую книгу — и задачи
          будут появляться сами к нужному сроку.
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {templates.map((template) => (
            <li key={template.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-48 flex-1">
                <p className={`font-medium ${template.isActive ? 'text-slate-800' : 'text-slate-400'}`}>
                  {template.title}
                </p>
                <p className="text-xs text-slate-500">
                  {template.schedule}
                  {template.leadDays > 0 ? ` · создаётся за ${template.leadDays} дн.` : ''}
                </p>
                <p className="text-xs text-slate-400">
                  {template.assignee} · заказчик {template.customer}
                  {template.checklistCount > 0 ? ` · чек-лист ${template.checklistCount}` : ''}
                </p>
              </div>
              <button
                type="button"
                className={`text-sm ${template.isActive ? 'text-emerald-600' : 'text-slate-400'}`}
                onClick={() => patch(template.id, { isActive: !template.isActive })}
              >
                {template.isActive ? 'включён' : 'выключен'}
              </button>
              <button
                type="button"
                className="text-xs text-red-500 hover:underline"
                onClick={() => remove(template.id)}
              >
                удалить
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
