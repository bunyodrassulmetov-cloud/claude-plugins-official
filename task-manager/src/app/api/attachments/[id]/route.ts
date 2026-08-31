import { NextRequest, NextResponse } from 'next/server';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { Readable } from 'node:stream';
import { prisma } from '@/lib/db';
import { HttpError, requireUser } from '@/lib/auth';
import { handle, ok } from '@/lib/api';
import { canCommentTask, canViewTask } from '@/lib/permissions';
import { deleteStoredFile, openStoredFile } from '@/lib/storage';

type Params = { params: Promise<{ id: string }> };

async function loadAttachment(id: number) {
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { task: true },
  });
  if (!attachment) throw new HttpError(404, 'Вложение не найдено');
  return attachment;
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const attachment = await loadAttachment(Number(id));
    if (!(await canViewTask(user, attachment.task))) throw new HttpError(403, 'Нет доступа к файлу');

    const { stream, size } = await openStoredFile(attachment.storedPath);
    const webStream = Readable.toWeb(stream) as WebReadableStream<Uint8Array>;
    return new NextResponse(webStream as unknown as BodyInit, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Length': String(size),
        // filename* — чтобы кириллические имена не ломали заголовок
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
      },
    });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const attachment = await loadAttachment(Number(id));
    const isOwner = attachment.uploadedById === user.id;
    if (!isOwner && !(await canCommentTask(user, attachment.task))) {
      throw new HttpError(403, 'Нет прав удалять вложение');
    }
    await prisma.attachment.delete({ where: { id: attachment.id } });
    await deleteStoredFile(attachment.storedPath);
    return ok({ success: true });
  });
}
