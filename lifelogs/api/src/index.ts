import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import eventsRoutes from './routes/events.js';
import schemasRoutes from './routes/schemas.js';
import importRoutes from './routes/import.js';
import type { Env, Variables } from './lib/types.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global middleware
app.use('*', logger());
app.use('*', async (c, next) => {
  const origins = ['http://localhost:5173', 'http://localhost:4173'];
  if (c.env.APP_URL) {
    origins.push(c.env.APP_URL);
  }
  return cors({
    origin: origins,
    credentials: true,
  })(c, next);
});
app.use('*', authMiddleware);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/events', eventsRoutes);
app.route('/api/schemas', schemasRoutes);
app.route('/api/import', importRoutes);

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json(
    { error: err.message || 'Internal server error' },
    500
  );
});

export default app;
