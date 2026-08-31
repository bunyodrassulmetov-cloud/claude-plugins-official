/**
 * Демо-данные: два отдела, все роли и задачи в разных состояниях
 * (в работе, на приёмке, выполненные, просроченные с прошлых дней).
 *   npm run db:seed
 */
import { PrismaClient, type Priority, type TaskStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();
const PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'Password123!';

const hours = (n: number) => new Date(Date.now() + n * 3_600_000);
const days = (n: number) => hours(n * 24);

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const upsertUser = (
    email: string,
    fullName: string,
    role: 'ADMIN' | 'DIRECTOR' | 'CHIEF_ACCOUNTANT' | 'ACCOUNTANT',
    position: string,
  ) =>
    prisma.user.upsert({
      where: { email },
      update: { fullName, role, position },
      create: { email, fullName, role, position, passwordHash },
    });

  const admin = await upsertUser('admin@company.ru', 'Администратор Системы', 'ADMIN', 'Системный администратор');
  const director = await upsertUser('director@company.ru', 'Ковалёв Игорь Петрович', 'DIRECTOR', 'Директор');
  const chief = await upsertUser('chief@company.ru', 'Морозова Елена Сергеевна', 'CHIEF_ACCOUNTANT', 'Главный бухгалтер');
  const chief2 = await upsertUser('chief2@company.ru', 'Титова Ольга Ивановна', 'CHIEF_ACCOUNTANT', 'Руководитель расчётного отдела');
  const acc1 = await upsertUser('accountant1@company.ru', 'Смирнова Анна Викторовна', 'ACCOUNTANT', 'Бухгалтер');
  const acc2 = await upsertUser('accountant2@company.ru', 'Петров Дмитрий Олегович', 'ACCOUNTANT', 'Бухгалтер');
  const acc3 = await upsertUser('operator1@company.ru', 'Кузнецова Мария Андреевна', 'ACCOUNTANT', 'Оператор');
  const acc4 = await upsertUser('operator2@company.ru', 'Волков Сергей Николаевич', 'ACCOUNTANT', 'Оператор');

  const accounting = await prisma.department.upsert({
    where: { name: 'Бухгалтерия' },
    update: { headId: chief.id },
    create: { name: 'Бухгалтерия', headId: chief.id },
  });
  const payroll = await prisma.department.upsert({
    where: { name: 'Расчётный отдел' },
    update: { headId: chief2.id },
    create: { name: 'Расчётный отдел', headId: chief2.id },
  });

  await prisma.user.update({ where: { id: chief.id }, data: { departmentId: accounting.id, managerId: director.id } });
  await prisma.user.update({ where: { id: chief2.id }, data: { departmentId: payroll.id, managerId: director.id } });
  for (const user of [acc1, acc2]) {
    await prisma.user.update({ where: { id: user.id }, data: { departmentId: accounting.id, managerId: chief.id } });
  }
  for (const user of [acc3, acc4]) {
    await prisma.user.update({ where: { id: user.id }, data: { departmentId: payroll.id, managerId: chief2.id } });
  }

  const existing = await prisma.task.count();
  if (existing > 0) {
    console.log(`Задачи уже есть (${existing}), пропускаю создание демо-задач.`);
    console.log(`Пароль всех демо-учёток: ${PASSWORD}`);
    return;
  }

  type Demo = {
    title: string;
    description: string;
    assigneeId: number;
    customerId: number;
    acceptorId?: number;
    departmentId: number;
    priority: Priority;
    status: TaskStatus;
    deadline: Date;
    note?: string;
  };

  const demoTasks: Demo[] = [
    {
      title: 'Сдать декларацию по НДС за квартал',
      description: 'Проверить книгу покупок и продаж, выгрузить в СБИС, отправить в ИФНС.',
      assigneeId: acc1.id, customerId: chief.id, acceptorId: chief.id, departmentId: accounting.id,
      priority: 'CRITICAL', status: 'IN_PROGRESS', deadline: hours(6),
      note: 'Расхождение по счёту 19 на 12 400 ₽ — уточняю у поставщика.',
    },
    {
      title: 'Акты сверки с ООО «Ромашка»',
      description: 'Подготовить и согласовать акты сверки за первое полугодие.',
      assigneeId: acc1.id, customerId: director.id, acceptorId: chief.id, departmentId: accounting.id,
      priority: 'HIGH', status: 'IN_PROGRESS', deadline: days(-2),
      note: 'Контрагент не отвечает третий день.',
    },
    {
      title: 'Начисление заработной платы за месяц',
      description: 'Проверить табели, начислить, сформировать реестр на выплату.',
      assigneeId: acc3.id, customerId: chief2.id, acceptorId: chief2.id, departmentId: payroll.id,
      priority: 'CRITICAL', status: 'PENDING_ACCEPTANCE', deadline: hours(3),
    },
    {
      title: 'Авансовые отчёты по командировкам',
      description: 'Обработать авансовые отчёты за прошлую неделю, приложить сканы.',
      assigneeId: acc2.id, customerId: chief.id, departmentId: accounting.id,
      priority: 'MEDIUM', status: 'DONE', deadline: hours(-4),
    },
    {
      title: 'Сверка расчётов с ФНС',
      description: 'Запросить справку о состоянии расчётов, разобрать расхождения.',
      assigneeId: acc2.id, customerId: chief.id, acceptorId: chief.id, departmentId: accounting.id,
      priority: 'MEDIUM', status: 'IN_PROGRESS', deadline: days(-1),
    },
    {
      title: 'Отчёт по страховым взносам',
      description: 'Сформировать РСВ, проверить контрольные соотношения.',
      assigneeId: acc4.id, customerId: chief2.id, acceptorId: chief2.id, departmentId: payroll.id,
      priority: 'HIGH', status: 'IN_PROGRESS', deadline: hours(20),
    },
    {
      title: 'Инвентаризация основных средств',
      description: 'Подготовить инвентаризационные описи по складу №2.',
      assigneeId: acc4.id, customerId: director.id, departmentId: payroll.id,
      priority: 'LOW', status: 'IN_PROGRESS', deadline: days(5),
    },
    {
      title: 'Больничные листы: проверка и отправка в СФР',
      description: 'Проверить ЭЛН за неделю, отправить сведения.',
      assigneeId: acc3.id, customerId: chief2.id, departmentId: payroll.id,
      priority: 'MEDIUM', status: 'DONE', deadline: hours(-26),
    },
    {
      title: 'Кассовая книга за неделю',
      description: 'Сформировать и подшить кассовую книгу, проверить лимит остатка.',
      assigneeId: acc1.id, customerId: chief.id, departmentId: accounting.id,
      priority: 'LOW', status: 'IN_PROGRESS', deadline: hours(10),
    },
  ];

  for (const item of demoTasks) {
    const done = item.status === 'DONE';
    const task = await prisma.task.create({
      data: {
        title: item.title,
        description: item.description,
        assigneeId: item.assigneeId,
        customerId: item.customerId,
        acceptorId: item.acceptorId ?? null,
        createdById: item.customerId,
        departmentId: item.departmentId,
        priority: item.priority,
        status: item.status,
        deadline: item.deadline,
        isOverdue: !done && item.status !== 'CANCELLED' && item.deadline < new Date(),
        overdueSince: item.deadline < new Date() && !done ? item.deadline : null,
        submittedAt: item.status === 'PENDING_ACCEPTANCE' || done ? new Date() : null,
        completedAt: done ? new Date() : null,
        notes: item.note ? { create: { authorId: item.assigneeId, body: item.note } } : undefined,
      },
    });
    await prisma.taskActivity.create({
      data: { taskId: task.id, actorId: item.customerId, action: 'created', details: { seed: true } },
    });
  }

  await prisma.notification.createMany({
    data: [
      { userId: acc1.id, type: 'TASK_OVERDUE', title: 'Задача просрочена', body: '«Акты сверки с ООО «Ромашка»» перенесена в текущий день.' },
      { userId: chief.id, type: 'TASK_SUBMITTED', title: 'Задача сдана на приёмку', body: 'Начисление заработной платы ждёт вашей приёмки.' },
    ],
  });

  console.log('Готово. Учётные записи:');
  console.table(
    [admin, director, chief, chief2, acc1, acc2, acc3, acc4].map((u) => ({
      email: u.email,
      роль: u.role,
      ФИО: u.fullName,
    })),
  );
  console.log(`Пароль всех демо-учёток: ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
