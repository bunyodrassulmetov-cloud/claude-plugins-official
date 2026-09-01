import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { HttpError, requireUser } from '@/lib/auth';
import { handle, ok } from '@/lib/api';
import { canCommentTask, canViewTask } from '@/lib/permissions';
import { deleteStoredFile, readStoredFile } from '@/lib/storage';

type Params = { params: Promise<{ id: string }> };

/** withData=false — не тянуть содержимое файла, когда нужны только метаданные. */
async function loadAttachment(id: number, withData: boolean) {
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: {
      id: true,
      storedPath: true,
      originalName: true,
      mimeType: true,
      uploadedById: true,
      data: withData,
      task: true,
    },
  });
  if (!attachment) throw new HttpError(404, 'Вложение не найдено');
  return attachment;
}

export async function GET(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await params;
    const attachment = await loadAttachment(Number(id), true);
    if (!(await canViewTask(user, attachment.task))) throw new HttpError(403, 'Нет доступа к файлу');

    const content = await readStoredFile({
      storedPath: attachment.storedPath,
      data: attachment.data ?? null,
    });
    return new NextResponse(content as unknown as BodyInit, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Length': String(content.byteLength),
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
    const attachment = await loadAttachment(Number(id), false);
    const isOwner = attachment.uploadedById === user.id;
    if (!isOwner && !(await canCommentTask(user, attachment.task))) {
      throw new HttpError(403, 'Нет прав удалять вложение');
    }
    await prisma.attachment.delete({ where: { id: attachment.id } });
    await deleteStoredFile(attachment.storedPath);
    return ok({ success: true });
  });
}
