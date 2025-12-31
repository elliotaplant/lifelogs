import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ulid } from 'ulid';
import { requireAuth } from '../middleware/auth.js';
import type { Env, Event, Variables } from '../lib/types.js';

const events = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require auth
events.use('*', requireAuth);

const createEventSchema = z.object({
  timestamp: z.number().optional(),
  event_type: z.string().min(1),
  data: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  source: z.enum(['manual', 'csv_import', 'json_import']).optional(),
});

const updateEventSchema = z.object({
  timestamp: z.number().optional(),
  event_type: z.string().min(1).optional(),
  data: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

const listQuerySchema = z.object({
  event_type: z.string().optional(),
  start: z.coerce.number().optional(),
  end: z.coerce.number().optional(),
  tags: z.string().optional(), // comma-separated
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
});

// List events
events.get('/', zValidator('query', listQuerySchema), async (c) => {
  const user = c.get('user')!;
  const { event_type, start, end, tags, limit, offset } = c.req.valid('query');

  let query = 'SELECT * FROM events WHERE user_id = ?';
  const params: (string | number)[] = [user.id];

  if (event_type) {
    query += ' AND event_type = ?';
    params.push(event_type);
  }

  if (start) {
    query += ' AND timestamp >= ?';
    params.push(start);
  }

  if (end) {
    query += ' AND timestamp <= ?';
    params.push(end);
  }

  if (tags) {
    // Filter events that contain any of the specified tags
    const tagList = tags.split(',').map((t) => t.trim());
    for (const tag of tagList) {
      query += ' AND tags LIKE ?';
      params.push(`%"${tag}"%`);
    }
  }

  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const result = await c.env.DB.prepare(query)
    .bind(...params)
    .all<Event>();

  // Parse JSON fields
  const eventsWithParsedData = result.results.map((event) => ({
    ...event,
    data: event.data ? JSON.parse(event.data) : null,
    tags: event.tags ? JSON.parse(event.tags) : [],
  }));

  return c.json({
    events: eventsWithParsedData,
    meta: {
      limit,
      offset,
      count: result.results.length,
    },
  });
});

// Get single event
events.get('/:id', async (c) => {
  const user = c.get('user')!;
  const eventId = c.req.param('id');

  const event = await c.env.DB.prepare(
    'SELECT * FROM events WHERE id = ? AND user_id = ?'
  )
    .bind(eventId, user.id)
    .first<Event>();

  if (!event) {
    return c.json({ error: 'Event not found' }, 404);
  }

  return c.json({
    event: {
      ...event,
      data: event.data ? JSON.parse(event.data) : null,
      tags: event.tags ? JSON.parse(event.tags) : [],
    },
  });
});

// Create event
events.post('/', zValidator('json', createEventSchema), async (c) => {
  const user = c.get('user')!;
  const body = c.req.valid('json');

  const eventId = ulid();
  const now = Date.now();

  await c.env.DB.prepare(
    'INSERT INTO events (id, user_id, timestamp, event_type, data, tags, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(
      eventId,
      user.id,
      body.timestamp ?? now,
      body.event_type,
      body.data ? JSON.stringify(body.data) : null,
      body.tags ? JSON.stringify(body.tags) : null,
      body.source ?? 'manual',
      now
    )
    .run();

  return c.json(
    {
      event: {
        id: eventId,
        user_id: user.id,
        timestamp: body.timestamp ?? now,
        event_type: body.event_type,
        data: body.data ?? null,
        tags: body.tags ?? [],
        source: body.source ?? 'manual',
        created_at: now,
      },
    },
    201
  );
});

// Update event
events.patch('/:id', zValidator('json', updateEventSchema), async (c) => {
  const user = c.get('user')!;
  const eventId = c.req.param('id');
  const body = c.req.valid('json');

  // Check event exists and belongs to user
  const existing = await c.env.DB.prepare(
    'SELECT * FROM events WHERE id = ? AND user_id = ?'
  )
    .bind(eventId, user.id)
    .first<Event>();

  if (!existing) {
    return c.json({ error: 'Event not found' }, 404);
  }

  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (body.timestamp !== undefined) {
    updates.push('timestamp = ?');
    params.push(body.timestamp);
  }

  if (body.event_type !== undefined) {
    updates.push('event_type = ?');
    params.push(body.event_type);
  }

  if (body.data !== undefined) {
    updates.push('data = ?');
    params.push(JSON.stringify(body.data));
  }

  if (body.tags !== undefined) {
    updates.push('tags = ?');
    params.push(JSON.stringify(body.tags));
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  params.push(eventId, user.id);

  await c.env.DB.prepare(
    `UPDATE events SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
  )
    .bind(...params)
    .run();

  // Fetch updated event
  const updated = await c.env.DB.prepare(
    'SELECT * FROM events WHERE id = ? AND user_id = ?'
  )
    .bind(eventId, user.id)
    .first<Event>();

  return c.json({
    event: {
      ...updated,
      data: updated?.data ? JSON.parse(updated.data) : null,
      tags: updated?.tags ? JSON.parse(updated.tags) : [],
    },
  });
});

// Delete event
events.delete('/:id', async (c) => {
  const user = c.get('user')!;
  const eventId = c.req.param('id');

  const result = await c.env.DB.prepare(
    'DELETE FROM events WHERE id = ? AND user_id = ?'
  )
    .bind(eventId, user.id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'Event not found' }, 404);
  }

  return c.json({ success: true });
});

// Get event types (distinct)
events.get('/types/list', async (c) => {
  const user = c.get('user')!;

  const result = await c.env.DB.prepare(
    'SELECT DISTINCT event_type FROM events WHERE user_id = ? ORDER BY event_type'
  )
    .bind(user.id)
    .all<{ event_type: string }>();

  return c.json({
    types: result.results.map((r) => r.event_type),
  });
});

export default events;
