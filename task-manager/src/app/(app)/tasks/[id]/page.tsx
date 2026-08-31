import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { config } from '@/lib/config';
import { formatDateTime, humanizeDeadline } from '@/lib/dates';
import { isTaskOverdue } from '@/lib/tasks';
import { getTaskForUser } from '@/lib/task-actions';
import {
  canAcceptTask,
  canCancelTask,
  canCommentTask,
  canDeleteTask,
  canEditTask,
  canSubmitTask,
} from '@/lib/permissions';
import TaskActions from '@/components/TaskActions';
import NoteComposer from '@/components/NoteComposer';
import AttachmentPanel from '@/components/AttachmentPanel';
import { PriorityBadge, StatusBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

const ACTIVITY_LABELS: Record<string, string> = {
  created: 'создал(а) задачу',
  updated: 'изменил(а) задачу',
  status_changed: 'изменил(а) статус',
  note_added: 'добавил(а) заметку',
  attachment_added: 'прикрепил(а) файл',
};

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isInteger(taskId)) notFound();

  const task = await getTaskForUser(user, taskId);
  const { timezone } = await getSettings();
  const now = new Date();

  const [notes, attachments, activity] = await Promise.all([
    prisma.taskNote.findMany({
      where: { taskId },
      include: { author: { select: { fullName: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.attachment.findMany({
      where: { taskId },
      include: { uploadedBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.taskActivity.findMany({
      where: { taskId },
      include: { actor: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  ]);

  const [editable, commentable, submittable, cancellable, deletable] = await Promise.all([
    canEditTask(user, task),
    canCommentTask(user, task),
    canSubmitTask(user, task),
    canCancelTask(user, task),
    canDeleteTask(user, task),
  ]);
  const acceptable = canAcceptTask(user, task);
  const closed = task.status === 'DONE' || task.status === 'CANCELLED';
  const overdue = isTaskOverdue(task, now);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/tasks" className="text-sm text-slate-500 hover:underline">
          ← К списку задач
        </Link>
        {editable ? (
          <Link href={`/tasks/${task.id}/edit`} className="btn-secondary">
            Редактировать
          </Link>
        ) : null}
      </div>

      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1
            className={`text-xl font-semibold ${
              closed ? 'text-slate-500 line-through decoration-slate-400' : 'text-slate-900'
            }`}
          >
            {task.title}
          </h1>
          <div className="flex flex-wrap gap-2">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} overdue={overdue} />
          </div>
        </div>

        {task.description ? (
          <p className="whitespace-pre-wrap text-sm text-slate-700">{task.description}</p>
        ) : (
          <p className="text-sm text-slate-400">Описание не заполнено.</p>
        )}

        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Исполнитель</dt>
            <dd className="font-medium text-slate-800">{task.assignee.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Заказчик</dt>
            <dd className="font-medium text-slate-800">{task.customer.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Принимающий</dt>
            <dd className="font-medium text-slate-800">
              {task.acceptor?.fullName ?? 'приёмка не требуется'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Дедлайн</dt>
            <dd className={`font-medium ${overdue ? 'text-red-600' : 'text-slate-800'}`}>
              {formatDateTime(task.deadline, timezone)}
              {!closed ? ` · ${humanizeDeadline(task.deadline, now)}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Создана</dt>
            <dd className="font-medium text-slate-800">{formatDateTime(task.createdAt, timezone)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Выполнена</dt>
            <dd className="font-medium text-slate-800">
              {task.completedAt ? formatDateTime(task.completedAt, timezone) : '—'}
            </dd>
          </div>
          {task.department ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Отдел</dt>
              <dd className="font-medium text-slate-800">{task.department.name}</dd>
            </div>
          ) : null}
          {task.carryOverDays > 0 && !closed ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Перенос</dt>
              <dd className="font-medium text-red-600">{task.carryOverDays} дн. без выполнения</dd>
            </div>
          ) : null}
        </dl>

        <TaskActions
          taskId={task.id}
          status={task.status}
          hasAcceptor={Boolean(task.acceptorId)}
          abilities={{
            submit: submittable,
            accept: acceptable,
            reject: acceptable,
            reopen: editable,
            cancel: cancellable,
            remove: deletable,
          }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Заметки</h2>
          {notes.length === 0 ? (
            <p className="text-sm text-slate-400">Заметок пока нет.</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((note) => (
                <li key={note.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{note.body}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {note.author.fullName} · {formatDateTime(note.createdAt, timezone)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {commentable ? <NoteComposer taskId={task.id} /> : null}
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Вложения</h2>
          <AttachmentPanel
            taskId={task.id}
            canUpload={commentable}
            maxMb={config.maxUploadMb}
            attachments={attachments.map((file) => ({
              id: file.id,
              originalName: file.originalName,
              sizeBytes: file.sizeBytes,
              uploadedBy: { fullName: file.uploadedBy.fullName },
              createdAt: file.createdAt.toISOString(),
            }))}
          />
        </section>
      </div>

      <section className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">История</h2>
        <ul className="space-y-2 text-sm text-slate-600">
          {activity.map((item) => (
            <li key={item.id} className="flex flex-wrap gap-2">
              <span className="text-slate-400">{formatDateTime(item.createdAt, timezone)}</span>
              <span className="font-medium text-slate-700">{item.actor?.fullName ?? 'Система'}</span>
              <span>{ACTIVITY_LABELS[item.action] ?? item.action}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
