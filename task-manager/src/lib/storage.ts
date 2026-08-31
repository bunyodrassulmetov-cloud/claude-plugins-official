import 'server-only';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } from './attachments';
import { config } from './config';
import { HttpError } from './auth';

const uploadRoot = path.resolve(process.cwd(), config.uploadDir);

export function maxUploadBytes() {
  return config.maxUploadMb * 1024 * 1024;
}

function assertAllowed(file: File) {
  if (file.size === 0) throw new HttpError(400, 'Файл пустой');
  if (file.size > maxUploadBytes()) {
    throw new HttpError(413, `Файл больше ${config.maxUploadMb} МБ`);
  }
  const ext = path.extname(file.name).toLowerCase();
  const byMime = ALLOWED_MIME_TYPES[file.type];
  if (!ALLOWED_EXTENSIONS.includes(ext) || (file.type && !byMime)) {
    throw new HttpError(
      415,
      `Недопустимый формат. Разрешены: ${ALLOWED_EXTENSIONS.join(', ')}`,
    );
  }
  if (byMime && !byMime.includes(ext)) {
    throw new HttpError(415, 'Расширение файла не соответствует его типу');
  }
  return ext;
}

/** Сохраняет файл под случайным именем; оригинальное имя живёт только в БД. */
export async function saveUpload(taskId: number, file: File) {
  const ext = assertAllowed(file);
  const relativeDir = path.join('tasks', String(taskId));
  await mkdir(path.join(uploadRoot, relativeDir), { recursive: true });

  const storedPath = path.join(relativeDir, `${randomUUID()}${ext}`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await (await import('node:fs/promises')).writeFile(path.join(uploadRoot, storedPath), buffer);

  return {
    originalName: path.basename(file.name).slice(0, 200),
    storedPath,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: buffer.byteLength,
  };
}

/** Абсолютный путь с защитой от выхода за пределы каталога загрузок. */
export function resolveStoredPath(storedPath: string) {
  const absolute = path.resolve(uploadRoot, storedPath);
  if (!absolute.startsWith(uploadRoot + path.sep)) {
    throw new HttpError(400, 'Некорректный путь к файлу');
  }
  return absolute;
}

export async function openStoredFile(storedPath: string) {
  const absolute = resolveStoredPath(storedPath);
  const info = await stat(absolute).catch(() => null);
  if (!info) throw new HttpError(404, 'Файл не найден на диске');
  return { stream: createReadStream(absolute), size: info.size };
}

export async function deleteStoredFile(storedPath: string) {
  await unlink(resolveStoredPath(storedPath)).catch(() => undefined);
}
