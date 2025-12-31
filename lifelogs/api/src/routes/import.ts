import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ulid } from 'ulid';
import { requireAuth } from '../middleware/auth.js';
import type { Env, Variables } from '../lib/types.js';

const importRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require auth
importRoutes.use('*', requireAuth);

const eventImportSchema = z.object({
  timestamp: z.union([z.string(), z.number()]),
  event_type: z.string().min(1),
  data: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

const jsonImportSchema = z.object({
  events: z.array(eventImportSchema),
});

// Parse timestamp from various formats
function parseTimestamp(value: string | number): number {
  if (typeof value === 'number') {
    // If it's a small number, assume it's seconds
    if (value < 10000000000) {
      return value * 1000;
    }
    return value;
  }

  // Try ISO string
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.getTime();
  }

  throw new Error(`Invalid timestamp: ${value}`);
}

// JSON Import
importRoutes.post('/json', zValidator('json', jsonImportSchema), async (c) => {
  const user = c.get('user')!;
  const { events } = c.req.valid('json');

  const now = Date.now();
  const results: { success: number; errors: string[] } = {
    success: 0,
    errors: [],
  };

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    try {
      const eventId = ulid();
      const timestamp = parseTimestamp(event.timestamp);

      await c.env.DB.prepare(
        'INSERT INTO events (id, user_id, timestamp, event_type, data, tags, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          eventId,
          user.id,
          timestamp,
          event.event_type,
          event.data ? JSON.stringify(event.data) : null,
          event.tags ? JSON.stringify(event.tags) : null,
          'json_import',
          now
        )
        .run();

      results.success++;
    } catch (err) {
      results.errors.push(
        `Event ${i}: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }

  return c.json({
    imported: results.success,
    total: events.length,
    errors: results.errors,
  });
});

// CSV Import
importRoutes.post('/csv', async (c) => {
  const user = c.get('user')!;
  const body = await c.req.text();

  const lines = body.trim().split('\n');
  if (lines.length < 2) {
    return c.json({ error: 'CSV must have at least a header and one data row' }, 400);
  }

  // Parse header
  const header = parseCSVLine(lines[0]);
  const requiredColumns = ['timestamp', 'event_type'];
  for (const col of requiredColumns) {
    if (!header.includes(col)) {
      return c.json({ error: `Missing required column: ${col}` }, 400);
    }
  }

  const timestampIdx = header.indexOf('timestamp');
  const eventTypeIdx = header.indexOf('event_type');
  const dataIdx = header.indexOf('data');
  const tagsIdx = header.indexOf('tags');

  const now = Date.now();
  const results: { success: number; errors: string[] } = {
    success: 0,
    errors: [],
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = parseCSVLine(line);
      const eventId = ulid();

      const timestamp = parseTimestamp(values[timestampIdx]);
      const eventType = values[eventTypeIdx];

      let data: Record<string, unknown> | null = null;
      if (dataIdx !== -1 && values[dataIdx]) {
        try {
          data = JSON.parse(values[dataIdx]);
        } catch {
          throw new Error('Invalid JSON in data column');
        }
      }

      let tags: string[] | null = null;
      if (tagsIdx !== -1 && values[tagsIdx]) {
        try {
          tags = JSON.parse(values[tagsIdx]);
        } catch {
          throw new Error('Invalid JSON in tags column');
        }
      }

      await c.env.DB.prepare(
        'INSERT INTO events (id, user_id, timestamp, event_type, data, tags, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(
          eventId,
          user.id,
          timestamp,
          eventType,
          data ? JSON.stringify(data) : null,
          tags ? JSON.stringify(tags) : null,
          'csv_import',
          now
        )
        .run();

      results.success++;
    } catch (err) {
      results.errors.push(
        `Line ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }

  return c.json({
    imported: results.success,
    total: lines.length - 1,
    errors: results.errors,
  });
});

// Simple CSV line parser that handles quoted strings
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// Preview CSV (without importing)
importRoutes.post('/csv/preview', async (c) => {
  const body = await c.req.text();

  const lines = body.trim().split('\n');
  if (lines.length < 2) {
    return c.json({ error: 'CSV must have at least a header and one data row' }, 400);
  }

  const header = parseCSVLine(lines[0]);
  const requiredColumns = ['timestamp', 'event_type'];
  const missingColumns = requiredColumns.filter((col) => !header.includes(col));

  if (missingColumns.length > 0) {
    return c.json({
      valid: false,
      error: `Missing required columns: ${missingColumns.join(', ')}`,
    });
  }

  const timestampIdx = header.indexOf('timestamp');
  const eventTypeIdx = header.indexOf('event_type');
  const dataIdx = header.indexOf('data');
  const tagsIdx = header.indexOf('tags');

  const preview: Array<{
    line: number;
    timestamp: string | number;
    event_type: string;
    data: unknown;
    tags: unknown;
    error?: string;
  }> = [];

  const maxPreview = Math.min(lines.length, 6);
  for (let i = 1; i < maxPreview; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const values = parseCSVLine(line);

      let data = null;
      if (dataIdx !== -1 && values[dataIdx]) {
        data = JSON.parse(values[dataIdx]);
      }

      let tags = null;
      if (tagsIdx !== -1 && values[tagsIdx]) {
        tags = JSON.parse(values[tagsIdx]);
      }

      preview.push({
        line: i + 1,
        timestamp: values[timestampIdx],
        event_type: values[eventTypeIdx],
        data,
        tags,
      });
    } catch (err) {
      preview.push({
        line: i + 1,
        timestamp: '',
        event_type: '',
        data: null,
        tags: null,
        error: err instanceof Error ? err.message : 'Parse error',
      });
    }
  }

  return c.json({
    valid: true,
    columns: header,
    total_rows: lines.length - 1,
    preview,
  });
});

export default importRoutes;
