import 'server-only';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } from './attachments';
import { config } from './config';
import { HttpError } from './auth';

const uploadRoot = path.resolve(process.cwd(), config.uploadDir);

/**
 * disk — файл на диске, в БД только путь (по умолчанию, для своего сервера).
 * database — содержимое в БД: нужно для хостингов без постоянного диска,
 * где всё записанное исчезает при следующем запуске.
 */
export const storageDriver = process.env.STORAGE_DRIVER === 'database' ? 'database' : 'disk';

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
    throw new HttpError(415, `Недопустимый формат. Разрешены: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }
  if (byMime && !byMime.includes(ext)) {
    throw new HttpError(415, 'Расширение файла не соответствует его типу');
  }
  return ext;
}

export type StoredFile = {
  originalName: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: number;
  data: Uint8Array<ArrayBuffer> | null;
};

/** Сохраняет файл под случайным именем; оригинальное имя живёт только в БД. */
export async function saveUpload(taskId: number, file: File): Promise<StoredFile> {
  const ext = assertAllowed(file);
  const buffer = new Uint8Array(await file.arrayBuffer());
  const meta = {
    originalName: path.basename(file.name).slice(0, 200),
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: buffer.byteLength,
  };

  if (storageDriver === 'database') {
    return { ...meta, storedPath: '', data: buffer };
  }

  const relativeDir = path.join('tasks', String(taskId));
  await mkdir(path.join(uploadRoot, relativeDir), { recursive: true });
  const storedPath = path.join(relativeDir, `${randomUUID()}${ext}`);
  await writeFile(path.join(uploadRoot, storedPath), buffer);
  return { ...meta, storedPath, data: null };
}

/** Абсолютный путь с защитой от выхода за пределы каталога загрузок. */
export function resolveStoredPath(storedPath: string) {
  const absolute = path.resolve(uploadRoot, storedPath);
  if (!absolute.startsWith(uploadRoot + path.sep)) {
    throw new HttpError(400, 'Некорректный путь к файлу');
  }
  return absolute;
}

/** Содержимое вложения независимо от того, где оно лежит. */
export async function readStoredFile(attachment: {
  storedPath: string;
  data: Uint8Array | null;
}): Promise<Uint8Array> {
  if (attachment.data) return attachment.data;
  if (!attachment.storedPath) throw new HttpError(404, 'Файл не найден');
  const absolute = resolveStoredPath(attachment.storedPath);
  const info = await stat(absolute).catch(() => null);
  if (!info) throw new HttpError(404, 'Файл не найден на диске');
  return new Uint8Array(await readFile(absolute));
}

export async function deleteStoredFile(storedPath: string) {
  if (!storedPath) return; // содержимое лежало в БД и удалилось вместе со строкой
  await unlink(resolveStoredPath(storedPath)).catch(() => undefined);
}
