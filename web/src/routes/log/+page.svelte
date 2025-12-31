<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { events as eventsApi, type Event } from '$lib/api';

  // Format date as local time for datetime-local input (YYYY-MM-DDTHH:MM)
  function toLocalDateTimeString(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  let recentEvents: Event[] = [];
  let recentTypes: Array<{ type: string; keys: string[] }> = [];
  let loading = true;

  let eventType = '';
  let fields: Array<{ key: string; value: string }> = [{ key: '', value: '' }];
  let timestamp = toLocalDateTimeString(new Date());

  let submitting = false;
  let error = '';
  let success = '';

  onMount(async () => {
    try {
      const { events } = await eventsApi.list({ limit: 50 });
      recentEvents = events;

      // Extract unique event types with their keys
      const typeMap = new Map<string, Set<string>>();
      for (const event of events) {
        if (!typeMap.has(event.event_type)) {
          typeMap.set(event.event_type, new Set());
        }
        if (event.data) {
          for (const key of Object.keys(event.data)) {
            typeMap.get(event.event_type)!.add(key);
          }
        }
      }

      recentTypes = Array.from(typeMap.entries())
        .map(([type, keys]) => ({ type, keys: Array.from(keys) }))
        .slice(0, 8);
    } catch (err) {
      // Ignore errors loading recent events
    } finally {
      loading = false;
    }
  });

  function selectRecentType(recent: { type: string; keys: string[] }) {
    eventType = recent.type;
    fields = recent.keys.length > 0
      ? recent.keys.map((key) => ({ key, value: '' }))
      : [{ key: '', value: '' }];
  }

  function addField() {
    fields = [...fields, { key: '', value: '' }];
  }

  function removeField(index: number) {
    fields = fields.filter((_, i) => i !== index);
    if (fields.length === 0) {
      fields = [{ key: '', value: '' }];
    }
  }

  async function handleSubmit() {
    error = '';
    success = '';

    if (!eventType.trim()) {
      error = 'Please enter an event type';
      return;
    }

    // Build data object from non-empty key-value pairs
    const data: Record<string, string> = {};
    for (const field of fields) {
      const key = field.key.trim();
      const value = field.value.trim();
      if (key && value) {
        data[key] = value;
      }
    }

    const ts = new Date(timestamp).getTime();

    submitting = true;

    try {
      await eventsApi.create({
        timestamp: ts,
        event_type: eventType.trim(),
        data: Object.keys(data).length > 0 ? data : undefined,
      });

      success = 'Event logged!';

      // Reset form but keep event type for quick repeat logging
      fields = fields.map((f) => ({ key: f.key, value: '' }));
      timestamp = toLocalDateTimeString(new Date());

      setTimeout(() => goto('/'), 800);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to log event';
    } finally {
      submitting = false;
    }
  }
</script>

<div class="log-page">
  <h1>Log Event</h1>

  <form on:submit|preventDefault={handleSubmit}>
    {#if error}
      <div class="error-alert">{error}</div>
    {/if}

    {#if success}
      <div class="success-alert">{success}</div>
    {/if}

    {#if recentTypes.length > 0}
      <div class="form-section">
        <h2>Recent</h2>
        <div class="recent-types">
          {#each recentTypes as recent}
            <button
              type="button"
              class="recent-btn"
              class:selected={eventType === recent.type}
              on:click={() => selectRecentType(recent)}
            >
              {recent.type}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="form-section">
      <h2>Event</h2>
      <div class="form-group">
        <label for="eventType" class="label">Event Type</label>
        <input
          type="text"
          id="eventType"
          class="input"
          bind:value={eventType}
          placeholder="e.g., weight, mood, exercise"
          required
        />
      </div>

      <div class="form-group">
        <label for="timestamp" class="label">When</label>
        <input
          type="datetime-local"
          id="timestamp"
          class="input"
          bind:value={timestamp}
        />
      </div>
    </div>

    <div class="form-section">
      <div class="section-header">
        <h2>Data</h2>
        <button type="button" class="btn btn-secondary btn-sm" on:click={addField}>
          + Add Field
        </button>
      </div>

      {#each fields as field, index}
        <div class="field-row">
          <input
            type="text"
            class="input"
            placeholder="key"
            bind:value={field.key}
          />
          <input
            type="text"
            class="input"
            placeholder="value"
            bind:value={field.value}
          />
          <button
            type="button"
            class="remove-btn"
            on:click={() => removeField(index)}
            aria-label="Remove field"
          >
            ×
          </button>
        </div>
      {/each}
      <p class="hint">Empty values will be ignored</p>
    </div>

    <button type="submit" class="btn btn-primary submit-btn" disabled={submitting}>
      {submitting ? 'Logging...' : 'Log Event'}
    </button>
  </form>
</div>

<style>
  .log-page {
    max-width: 500px;
    margin: 0 auto;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 1.5rem;
  }

  .error-alert {
    background-color: rgb(239 68 68 / 0.1);
    color: var(--color-danger);
    padding: 0.75rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }

  .success-alert {
    background-color: rgb(34 197 94 / 0.1);
    color: var(--color-success);
    padding: 0.75rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }

  .form-section {
    background-color: white;
    padding: 1.25rem;
    border-radius: 0.75rem;
    box-shadow: var(--shadow-sm);
    margin-bottom: 1rem;
  }

  .form-section h2 {
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0 0 0.75rem;
    color: var(--color-gray-600);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .section-header h2 {
    margin: 0;
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }

  .recent-types {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .recent-btn {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-gray-300);
    border-radius: 9999px;
    background-color: white;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .recent-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .recent-btn.selected {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  .field-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .field-row .input {
    flex: 1;
  }

  .field-row .input:first-child {
    flex: 0.8;
  }

  .remove-btn {
    width: 36px;
    height: 36px;
    border: none;
    background-color: var(--color-gray-100);
    color: var(--color-gray-500);
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 1.25rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .remove-btn:hover {
    background-color: var(--color-gray-200);
    color: var(--color-danger);
  }

  .hint {
    font-size: 0.75rem;
    color: var(--color-gray-500);
    margin: 0.5rem 0 0;
  }

  .submit-btn {
    width: 100%;
    padding: 0.875rem;
    font-size: 1rem;
  }
</style>
