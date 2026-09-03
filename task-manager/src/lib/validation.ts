import { z } from 'zod';

export const priorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const statusEnum = z.enum(['IN_PROGRESS', 'PENDING_ACCEPTANCE', 'DONE', 'CANCELLED']);
export const roleEnum = z.enum(['ADMIN', 'DIRECTOR', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT']);

export const loginSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

export const taskCreateSchema = z.object({
  title: z.string().trim().min(3, 'Название — минимум 3 символа').max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  assigneeId: z.coerce.number().int().positive('Выберите исполнителя'),
  customerId: z.coerce.number().int().positive('Выберите заказчика'),
  acceptorId: z.coerce.number().int().positive().optional().nullable(),
  coAssigneeIds: z.array(z.coerce.number().int().positive()).max(15).optional(),
  priority: priorityEnum.default('MEDIUM'),
  deadline: z.coerce.date({ errorMap: () => ({ message: 'Укажите корректный дедлайн' }) }),
  note: z.string().trim().max(5000).optional().nullable(),
});

export const taskUpdateSchema = taskCreateSchema.partial().omit({ note: true });

export const taskActionSchema = z.object({
  action: z.enum(['submit', 'accept', 'reject', 'reopen', 'cancel', 'complete']),
  comment: z.string().trim().max(2000).optional().nullable(),
});

export const checklistCreateSchema = z.object({
  title: z.string().trim().min(1, 'Введите название пункта').max(300),
});

export const checklistUpdateSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  isDone: z.boolean().optional(),
});

export const noteSchema = z.object({
  body: z.string().trim().min(1, 'Заметка не может быть пустой').max(5000),
});

export const userCreateSchema = z.object({
  email: z.string().email('Некорректный email').toLowerCase(),
  fullName: z.string().trim().min(3, 'Укажите ФИО').max(150),
  position: z.string().trim().max(150).optional().nullable(),
  password: z.string().min(8, 'Пароль — минимум 8 символов').max(100),
  role: roleEnum,
  departmentId: z.coerce.number().int().positive().optional().nullable(),
  managerId: z.coerce.number().int().positive().optional().nullable(),
});

export const userUpdateSchema = userCreateSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .omit({ password: true })
  .extend({ password: z.string().min(8).max(100).optional().or(z.literal('')) });

export const departmentSchema = z.object({
  name: z.string().trim().min(2, 'Название отдела — минимум 2 символа').max(120),
  headId: z.coerce.number().int().positive().optional().nullable(),
});

export const settingsSchema = z.object({
  dailyReportTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Формат времени — ЧЧ:ММ'),
  timezone: z.string().trim().min(3).max(64),
  deadlineReminderHours: z.coerce.number().int().min(1).max(168),
});

/** Единый разбор тела запроса: возвращает данные либо текст ошибки. */
export function parseBody<T extends z.ZodTypeAny>(schema: T, data: unknown) {
  const result = schema.safeParse(data);
  if (result.success) return { data: result.data as z.infer<T>, error: null as string | null };
  const message = result.error.errors.map((e) => e.message).join('; ');
  return { data: null, error: message };
}
