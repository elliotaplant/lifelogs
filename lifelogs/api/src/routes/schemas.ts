import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ulid } from 'ulid';
import { requireAuth } from '../middleware/auth.js';
import type { Env, EventSchema, Variables } from '../lib/types.js';

const schemas = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require auth
schemas.use('*', requireAuth);

const fieldDefinitionSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['string', 'number', 'decimal', 'boolean', 'date', 'datetime']),
  required: z.boolean().optional(),
  primary: z.boolean().optional(),
  unit: z.string().optional(),
});

const createSchemaSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1),
  fields: z.array(fieldDefinitionSchema).min(1),
  icon: z.string().optional(),
  color: z.string().optional(),
  default_tags: z.array(z.string()).optional(),
});

const updateSchemaSchema = z.object({
  label: z.string().min(1).optional(),
  fields: z.array(fieldDefinitionSchema).min(1).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  default_tags: z.array(z.string()).optional(),
});

// List schemas
schemas.get('/', async (c) => {
  const user = c.get('user')!;

  const result = await c.env.DB.prepare(
    'SELECT * FROM event_schemas WHERE user_id = ? ORDER BY name'
  )
    .bind(user.id)
    .all<EventSchema>();

  const schemasWithParsedData = result.results.map((schema) => ({
    ...schema,
    fields: JSON.parse(schema.fields),
    default_tags: schema.default_tags ? JSON.parse(schema.default_tags) : [],
  }));

  return c.json({ schemas: schemasWithParsedData });
});

// Get single schema
schemas.get('/:id', async (c) => {
  const user = c.get('user')!;
  const schemaId = c.req.param('id');

  const schema = await c.env.DB.prepare(
    'SELECT * FROM event_schemas WHERE id = ? AND user_id = ?'
  )
    .bind(schemaId, user.id)
    .first<EventSchema>();

  if (!schema) {
    return c.json({ error: 'Schema not found' }, 404);
  }

  return c.json({
    schema: {
      ...schema,
      fields: JSON.parse(schema.fields),
      default_tags: schema.default_tags ? JSON.parse(schema.default_tags) : [],
    },
  });
});

// Get schema by name
schemas.get('/by-name/:name', async (c) => {
  const user = c.get('user')!;
  const name = c.req.param('name');

  const schema = await c.env.DB.prepare(
    'SELECT * FROM event_schemas WHERE name = ? AND user_id = ?'
  )
    .bind(name, user.id)
    .first<EventSchema>();

  if (!schema) {
    return c.json({ error: 'Schema not found' }, 404);
  }

  return c.json({
    schema: {
      ...schema,
      fields: JSON.parse(schema.fields),
      default_tags: schema.default_tags ? JSON.parse(schema.default_tags) : [],
    },
  });
});

// Create schema
schemas.post('/', zValidator('json', createSchemaSchema), async (c) => {
  const user = c.get('user')!;
  const body = c.req.valid('json');

  // Check if name already exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM event_schemas WHERE name = ? AND user_id = ?'
  )
    .bind(body.name, user.id)
    .first();

  if (existing) {
    return c.json({ error: 'Schema with this name already exists' }, 400);
  }

  const schemaId = ulid();
  const now = Date.now();

  await c.env.DB.prepare(
    'INSERT INTO event_schemas (id, user_id, name, label, fields, icon, color, default_tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(
      schemaId,
      user.id,
      body.name,
      body.label,
      JSON.stringify(body.fields),
      body.icon ?? null,
      body.color ?? null,
      body.default_tags ? JSON.stringify(body.default_tags) : null,
      now
    )
    .run();

  return c.json(
    {
      schema: {
        id: schemaId,
        user_id: user.id,
        name: body.name,
        label: body.label,
        fields: body.fields,
        icon: body.icon ?? null,
        color: body.color ?? null,
        default_tags: body.default_tags ?? [],
        created_at: now,
      },
    },
    201
  );
});

// Update schema
schemas.patch('/:id', zValidator('json', updateSchemaSchema), async (c) => {
  const user = c.get('user')!;
  const schemaId = c.req.param('id');
  const body = c.req.valid('json');

  // Check schema exists and belongs to user
  const existing = await c.env.DB.prepare(
    'SELECT * FROM event_schemas WHERE id = ? AND user_id = ?'
  )
    .bind(schemaId, user.id)
    .first<EventSchema>();

  if (!existing) {
    return c.json({ error: 'Schema not found' }, 404);
  }

  const updates: string[] = [];
  const params: (string | null)[] = [];

  if (body.label !== undefined) {
    updates.push('label = ?');
    params.push(body.label);
  }

  if (body.fields !== undefined) {
    updates.push('fields = ?');
    params.push(JSON.stringify(body.fields));
  }

  if (body.icon !== undefined) {
    updates.push('icon = ?');
    params.push(body.icon);
  }

  if (body.color !== undefined) {
    updates.push('color = ?');
    params.push(body.color);
  }

  if (body.default_tags !== undefined) {
    updates.push('default_tags = ?');
    params.push(JSON.stringify(body.default_tags));
  }

  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  params.push(schemaId, user.id);

  await c.env.DB.prepare(
    `UPDATE event_schemas SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
  )
    .bind(...params)
    .run();

  // Fetch updated schema
  const updated = await c.env.DB.prepare(
    'SELECT * FROM event_schemas WHERE id = ? AND user_id = ?'
  )
    .bind(schemaId, user.id)
    .first<EventSchema>();

  return c.json({
    schema: {
      ...updated,
      fields: updated?.fields ? JSON.parse(updated.fields) : [],
      default_tags: updated?.default_tags
        ? JSON.parse(updated.default_tags)
        : [],
    },
  });
});

// Delete schema
schemas.delete('/:id', async (c) => {
  const user = c.get('user')!;
  const schemaId = c.req.param('id');

  const result = await c.env.DB.prepare(
    'DELETE FROM event_schemas WHERE id = ? AND user_id = ?'
  )
    .bind(schemaId, user.id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'Schema not found' }, 404);
  }

  return c.json({ success: true });
});

export default schemas;
