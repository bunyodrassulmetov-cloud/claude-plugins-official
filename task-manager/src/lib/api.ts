import { NextResponse } from 'next/server';
import { HttpError } from './auth';

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Единая обёртка для route handlers: ошибки не текут наружу стектрейсом. */
export async function handle<T>(fn: () => Promise<NextResponse<T> | NextResponse>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) return fail(error.message, error.status);
    console.error('[api]', error);
    return fail('Внутренняя ошибка сервера', 500);
  }
}
