import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Env, User, Session, Variables } from '../lib/types.js';

const SESSION_COOKIE_NAME = 'lifelogs_session';

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME);

  if (sessionId) {
    const session = await c.env.DB.prepare(
      'SELECT * FROM auth_sessions WHERE id = ? AND expires_at > ?'
    )
      .bind(sessionId, Date.now())
      .first<Session>();

    if (session) {
      const user = await c.env.DB.prepare(
        'SELECT id, email, email_verified, created_at, updated_at FROM auth_users WHERE id = ?'
      )
        .bind(session.user_id)
        .first<User>();

      if (user) {
        c.set('user', user);
        c.set('session', session);
      }
    }
  }

  await next();
}

export async function requireAuth(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
}

export { SESSION_COOKIE_NAME };
