'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

type Option = { value: string; label: string };

export default function TaskFilters({
  assignees,
  departments,
  showAssignee,
}: {
  assignees: Option[];
  departments: Option[];
  showAssignee: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`/tasks?${next.toString()}`));
  }

  const value = (key: string) => params.get(key) ?? '';

  return (
    <div className={`card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 ${pending ? 'opacity-60' : ''}`}>
      <div>
        <label className="label" htmlFor="f-view">
          Период
        </label>
        <select id="f-view" className="input" value={value('view')} onChange={(e) => update('view', e.target.value)}>
          <option value="">Все задачи</option>
          <option value="today">Текущий день + хвосты</option>
          <option value="overdue">Только просроченные</option>
          <option value="archive">Архив (выполненные)</option>
        </select>
      </div>

      <div>
        <label className="label" htmlFor="f-status">
          Статус
        </label>
        <select id="f-status" className="input" value={value('status')} onChange={(e) => update('status', e.target.value)}>
          <option value="">Любой</option>
          <option value="IN_PROGRESS">В работе</option>
          <option value="PENDING_ACCEPTANCE">На приёмке</option>
          <option value="DONE">Выполнено</option>
          <option value="CANCELLED">Отменена</option>
        </select>
      </div>

      <div>
        <label className="label" htmlFor="f-priority">
          Приоритет
        </label>
        <select
          id="f-priority"
          className="input"
          value={value('priority')}
          onChange={(e) => update('priority', e.target.value)}
        >
          <option value="">Любой</option>
          <option value="CRITICAL">Критичный</option>
          <option value="HIGH">Высокий</option>
          <option value="MEDIUM">Средний</option>
          <option value="LOW">Низкий</option>
        </select>
      </div>

      {showAssignee ? (
        <div>
          <label className="label" htmlFor="f-assignee">
            Исполнитель
          </label>
          <select
            id="f-assignee"
            className="input"
            value={value('assigneeId')}
            onChange={(e) => update('assigneeId', e.target.value)}
          >
            <option value="">Все</option>
            {assignees.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {departments.length > 0 ? (
        <div>
          <label className="label" htmlFor="f-department">
            Отдел
          </label>
          <select
            id="f-department"
            className="input"
            value={value('departmentId')}
            onChange={(e) => update('departmentId', e.target.value)}
          >
            <option value="">Все отделы</option>
            {departments.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="f-from">
          Дедлайн с
        </label>
        <input
          id="f-from"
          type="date"
          className="input"
          value={value('from')}
          onChange={(e) => update('from', e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="f-to">
          Дедлайн по
        </label>
        <input
          id="f-to"
          type="date"
          className="input"
          value={value('to')}
          onChange={(e) => update('to', e.target.value)}
        />
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label" htmlFor="f-search">
            Поиск
          </label>
          <input
            id="f-search"
            className="input"
            placeholder="Название или описание"
            defaultValue={value('search')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') update('search', (e.target as HTMLInputElement).value);
            }}
            onBlur={(e) => update('search', e.target.value)}
          />
        </div>
        <button type="button" className="btn-secondary" onClick={() => startTransition(() => router.replace('/tasks'))}>
          Сброс
        </button>
      </div>
    </div>
  );
}
