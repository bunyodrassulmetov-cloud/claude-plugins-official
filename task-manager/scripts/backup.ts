/**
 * Резервная копия базы: npm run backup
 *
 * Вызывает pg_dump с тем же DATABASE_URL, что и приложение, и кладёт файл
 * в ./backups. Нужен установленный клиент PostgreSQL (он ставится вместе с сервером).
 * Восстановление: pg_restore --clean --no-owner -d "$DATABASE_URL" файл.dump
 */
import { execFile } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import 'dotenv/config';

const run = promisify(execFile);

/**
 * Prisma держит в строке подключения свои параметры (schema, pgbouncer, connection_limit),
 * а pg_dump на них ругается. Убираем их, а schema передаём отдельным ключом.
 */
function splitConnection(raw: string) {
  const url = new URL(raw);
  const schema = url.searchParams.get('schema');
  for (const key of ['schema', 'pgbouncer', 'connection_limit', 'pool_timeout']) {
    url.searchParams.delete(key);
  }
  return { url: url.toString(), schema };
}

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL не задан — проверьте файл .env');
  const { url, schema } = splitConnection(raw);

  const dir = path.resolve(process.cwd(), process.env.BACKUP_DIR ?? './backups');
  await mkdir(dir, { recursive: true });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const file = path.join(dir, `taskmanager-${stamp}.dump`);

  try {
    await run('pg_dump', [
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      ...(schema ? [`--schema=${schema}`] : []),
      '--file',
      file,
      url,
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('ENOENT')) {
      throw new Error(
        'Не найдена программа pg_dump. Она устанавливается вместе с PostgreSQL; ' +
          'на Windows добавьте в PATH каталог вида C:\\Program Files\\PostgreSQL\\16\\bin',
      );
    }
    throw error;
  }

  const info = await stat(file);
  console.log(`Копия готова: ${file} (${(info.size / 1024).toFixed(0)} КБ)`);
  console.log('Восстановление: pg_restore --clean --no-owner -d "$DATABASE_URL" ' + path.basename(file));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
