import 'server-only';

/**
 * Отправка писем через Resend. Включается при заданном RESEND_API_KEY —
 * без него письма не уходят, а приложение сообщает, что нужно обратиться к администратору.
 */
const API = process.env.RESEND_API_BASE ?? 'https://api.resend.com';

export function emailEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendEmail(to: string, subject: string, text: string) {
  if (!emailEnabled()) return false;
  try {
    const response = await fetch(`${API}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error('[email]', response.status, await response.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (error) {
    console.error('[email]', error);
    return false;
  }
}
