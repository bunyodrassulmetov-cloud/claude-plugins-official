/**
 * Начальные данные: отделы, сотрудники и несколько демонстрационных задач.
 *   npm run db:seed
 *
 * Чтобы изменить штат — правьте два списка ниже (DEPARTMENTS и STAFF)
 * и запускайте `npx prisma migrate reset`: база пересоздастся с новым составом.
 * Сотрудники сопоставляются по email, поэтому повторный запуск не плодит дубликаты.
 */
import { PrismaClient, type Priority, type Role, type TaskStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();
const PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'Password123!';

/** Отделы. headEmail — руководитель, которому приходит ежедневная сводка по отделу. */
const DEPARTMENTS: { name: string; headEmail: string }[] = [
  { name: 'Бухгалтерия', headEmail: 'suhrob@company.ru' },
  { name: 'Дизайн', headEmail: 'gayrat@company.ru' },
];

/**
 * Сотрудники.
 * role: ADMIN — учётные записи и настройки; DIRECTOR — видит всё;
 *       CHIEF_ACCOUNTANT — свой отдел и отчёты по нему; ACCOUNTANT — только свои задачи.
 */
const STAFF: {
  email: string;
  fullName: string;
  position: string;
  role: Role;
  department?: string;
  managerEmail?: string;
}[] = [
  {
    email: 'admin@company.ru',
    fullName: 'Администратор системы',
    position: 'Системный администратор',
    role: 'ADMIN',
  },
  {
    email: 'gayrat@company.ru',
    fullName: 'Гайрат Ниязходжаев',
    position: 'Директор',
    role: 'DIRECTOR',
  },
  {
    email: 'suhrob@company.ru',
    fullName: 'Сухроб Ирискулов',
    position: 'Главный бухгалтер',
    role: 'CHIEF_ACCOUNTANT',
    department: 'Бухгалтерия',
    managerEmail: 'gayrat@company.ru',
  },
  { email: 'olimboy@company.ru', fullName: 'Олимбой', position: 'Бухгалтер', role: 'ACCOUNTANT', department: 'Бухгалтерия', managerEmail: 'suhrob@company.ru' },
  { email: 'shohruh@company.ru', fullName: 'Шохрух', position: 'Бухгалтер', role: 'ACCOUNTANT', department: 'Бухгалтерия', managerEmail: 'suhrob@company.ru' },
  { email: 'shahriyor@company.ru', fullName: 'Шахриёр', position: 'Бухгалтер', role: 'ACCOUNTANT', department: 'Бухгалтерия', managerEmail: 'suhrob@company.ru' },
  { email: 'zohid@company.ru', fullName: 'Зохид', position: 'Бухгалтер', role: 'ACCOUNTANT', department: 'Бухгалтерия', managerEmail: 'suhrob@company.ru' },
  { email: 'bilol@company.ru', fullName: 'Билол', position: 'Бухгалтер', role: 'ACCOUNTANT', department: 'Бухгалтерия', managerEmail: 'suhrob@company.ru' },
  { email: 'kamolhon@company.ru', fullName: 'Камолхон', position: 'Бухгалтер', role: 'ACCOUNTANT', department: 'Бухгалтерия', managerEmail: 'suhrob@company.ru' },
  { email: 'samandar@company.ru', fullName: 'Самандар', position: 'Дизайнер', role: 'ACCOUNTANT', department: 'Дизайн', managerEmail: 'gayrat@company.ru' },
];

const hours = (n: number) => new Date(Date.now() + n * 3_600_000);
const days = (n: number) => hours(n * 24);

/** Демонстрационные задачи: в работе, на приёмке, выполненные и просроченные. */
const DEMO_TASKS: {
  title: string;
  description: string;
  assignee: string;
  customer: string;
  acceptor?: string;
  priority: Priority;
  status: TaskStatus;
  deadline: Date;
  note?: string;
}[] = [
  {
    title: 'Сдать декларацию по НДС за квартал',
    description: 'Проверить книгу покупок и продаж, выгрузить отчёт, отправить в налоговую.',
    assignee: 'olimboy@company.ru', customer: 'suhrob@company.ru', acceptor: 'suhrob@company.ru',
    priority: 'CRITICAL', status: 'IN_PROGRESS', deadline: hours(6),
    note: 'Расхождение по счёту на 12 400 — уточняю у поставщика.',
  },
  {
    title: 'Акты сверки с ООО «Ромашка»',
    description: 'Подготовить и согласовать акты сверки за первое полугодие.',
    assignee: 'olimboy@company.ru', customer: 'gayrat@company.ru', acceptor: 'suhrob@company.ru',
    priority: 'HIGH', status: 'IN_PROGRESS', deadline: days(-2),
    note: 'Контрагент не отвечает третий день.',
  },
  {
    title: 'Начисление заработной платы за месяц',
    description: 'Проверить табели, начислить, сформировать реестр на выплату.',
    assignee: 'shohruh@company.ru', customer: 'suhrob@company.ru', acceptor: 'suhrob@company.ru',
    priority: 'CRITICAL', status: 'PENDING_ACCEPTANCE', deadline: hours(3),
  },
  {
    title: 'Авансовые отчёты по командировкам',
    description: 'Обработать авансовые отчёты за прошлую неделю, приложить сканы.',
    assignee: 'shahriyor@company.ru', customer: 'suhrob@company.ru',
    priority: 'MEDIUM', status: 'DONE', deadline: hours(-4),
  },
  {
    title: 'Сверка расчётов с налоговой',
    description: 'Запросить справку о состоянии расчётов, разобрать расхождения.',
    assignee: 'zohid@company.ru', customer: 'suhrob@company.ru', acceptor: 'suhrob@company.ru',
    priority: 'MEDIUM', status: 'IN_PROGRESS', deadline: days(-1),
  },
  {
    title: 'Отчёт по страховым взносам',
    description: 'Сформировать отчёт, проверить контрольные соотношения.',
    assignee: 'bilol@company.ru', customer: 'suhrob@company.ru', acceptor: 'suhrob@company.ru',
    priority: 'HIGH', status: 'IN_PROGRESS', deadline: hours(20),
  },
  {
    title: 'Инвентаризация основных средств',
    description: 'Подготовить инвентаризационные описи по складу №2.',
    assignee: 'kamolhon@company.ru', customer: 'gayrat@company.ru',
    priority: 'LOW', status: 'IN_PROGRESS', deadline: days(5),
  },
  {
    title: 'Кассовая книга за неделю',
    description: 'Сформировать и подшить кассовую книгу, проверить лимит остатка.',
    assignee: 'kamolhon@company.ru', customer: 'suhrob@company.ru',
    priority: 'LOW', status: 'DONE', deadline: hours(-26),
  },
  {
    title: 'Макет годового отчёта для инвесторов',
    description: 'Свёрстать презентацию по данным бухгалтерии, 12 слайдов.',
    assignee: 'samandar@company.ru', customer: 'gayrat@company.ru', acceptor: 'gayrat@company.ru',
    priority: 'HIGH', status: 'IN_PROGRESS', deadline: days(3),
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // 1. Отделы (без руководителей — их назначаем после создания сотрудников)
  const departments = new Map<string, number>();
  for (const item of DEPARTMENTS) {
    const department = await prisma.department.upsert({
      where: { name: item.name },
      update: {},
      create: { name: item.name },
    });
    departments.set(item.name, department.id);
  }

  // 2. Сотрудники
  const users = new Map<string, number>();
  for (const person of STAFF) {
    const user = await prisma.user.upsert({
      where: { email: person.email },
      update: {
        fullName: person.fullName,
        position: person.position,
        role: person.role,
        departmentId: person.department ? departments.get(person.department) : null,
      },
      create: {
        email: person.email,
        fullName: person.fullName,
        position: person.position,
        role: person.role,
        departmentId: person.department ? departments.get(person.department) : null,
        passwordHash,
      },
    });
    users.set(person.email, user.id);
  }

  // 3. Руководители сотрудников и руководители отделов
  for (const person of STAFF) {
    if (!person.managerEmail) continue;
    await prisma.user.update({
      where: { id: users.get(person.email) },
      data: { managerId: users.get(person.managerEmail) ?? null },
    });
  }
  for (const item of DEPARTMENTS) {
    await prisma.department.update({
      where: { id: departments.get(item.name) },
      data: { headId: users.get(item.headEmail) ?? null },
    });
  }

  // 4. Демо-задачи — только если задач ещё нет
  const existing = await prisma.task.count();
  if (existing > 0) {
    console.log(`Задачи уже есть (${existing}) — создаю только сотрудников.`);
    printStaff();
    return;
  }

  for (const item of DEMO_TASKS) {
    const assigneeId = users.get(item.assignee)!;
    const customerId = users.get(item.customer)!;
    const person = STAFF.find((s) => s.email === item.assignee);
    const done = item.status === 'DONE';

    const task = await prisma.task.create({
      data: {
        title: item.title,
        description: item.description,
        assigneeId,
        customerId,
        acceptorId: item.acceptor ? users.get(item.acceptor) : null,
        createdById: customerId,
        departmentId: person?.department ? departments.get(person.department) : null,
        priority: item.priority,
        status: item.status,
        deadline: item.deadline,
        isOverdue: !done && item.status !== 'CANCELLED' && item.deadline < new Date(),
        overdueSince: !done && item.deadline < new Date() ? item.deadline : null,
        submittedAt: item.status === 'PENDING_ACCEPTANCE' || done ? new Date() : null,
        completedAt: done ? new Date() : null,
        notes: item.note ? { create: { authorId: assigneeId, body: item.note } } : undefined,
      },
    });
    await prisma.taskActivity.create({
      data: { taskId: task.id, actorId: customerId, action: 'created', details: { seed: true } },
    });
  }

  printStaff();
}

function printStaff() {
  const roles: Record<Role, string> = {
    ADMIN: 'администратор',
    DIRECTOR: 'директор',
    CHIEF_ACCOUNTANT: 'главный бухгалтер',
    ACCOUNTANT: 'сотрудник',
  };
  console.log('\nУчётные записи:');
  console.table(
    STAFF.map((person) => ({
      Логин: person.email,
      ФИО: person.fullName,
      Должность: person.position,
      Доступ: roles[person.role],
    })),
  );
  console.log(`Пароль у всех: ${PASSWORD}\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
