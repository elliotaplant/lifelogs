<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import {
    events as eventsApi,
    schemas as schemasApi,
    type EventSchema,
    type FieldDefinition,
  } from '$lib/api';

  let schemas: EventSchema[] = [];
  let selectedSchema: EventSchema | null = null;
  let customEventType = '';
  let useCustomType = false;

  let formData: Record<string, string | number | boolean> = {};
  let customFields: Array<{ key: string; value: string }> = [];
  let tags: string[] = [];
  let tagInput = '';
  let timestamp = new Date().toISOString().slice(0, 16); // For datetime-local input

  let loading = true;
  let submitting = false;
  let error = '';
  let success = '';

  onMount(async () => {
    try {
      const { schemas: s } = await schemasApi.list();
      schemas = s;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load schemas';
    } finally {
      loading = false;
    }
  });

  function selectSchema(schema: EventSchema | null) {
    selectedSchema = schema;
    useCustomType = schema === null;
    formData = {};
    customFields = [];

    if (schema?.default_tags) {
      tags = [...schema.default_tags];
    } else {
      tags = [];
    }
  }

  function addCustomField() {
    customFields = [...customFields, { key: '', value: '' }];
  }

  function removeCustomField(index: number) {
    customFields = customFields.filter((_, i) => i !== index);
  }

  function addTag() {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      tags = [...tags, tag];
      tagInput = '';
    }
  }

  function removeTag(tag: string) {
    tags = tags.filter((t) => t !== tag);
  }

  function handleTagKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTag();
    }
  }

  async function handleSubmit() {
    error = '';
    success = '';

    const eventType = useCustomType ? customEventType : selectedSchema?.name;
    if (!eventType) {
      error = 'Please select or enter an event type';
      return;
    }

    // Build data object
    const data: Record<string, unknown> = { ...formData };

    // Add custom fields
    for (const field of customFields) {
      if (field.key.trim()) {
        // Try to parse as number
        const numValue = parseFloat(field.value);
        data[field.key.trim()] = isNaN(numValue) ? field.value : numValue;
      }
    }

    // Parse timestamp
    const ts = new Date(timestamp).getTime();

    submitting = true;

    try {
      await eventsApi.create({
        timestamp: ts,
        event_type: eventType,
        data: Object.keys(data).length > 0 ? data : undefined,
        tags: tags.length > 0 ? tags : undefined,
      });

      success = 'Event logged successfully!';

      // Reset form
      formData = {};
      customFields = [];
      if (!selectedSchema?.default_tags) {
        tags = [];
      }
      timestamp = new Date().toISOString().slice(0, 16);

      // Redirect to dashboard after short delay
      setTimeout(() => goto('/'), 1000);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to log event';
    } finally {
      submitting = false;
    }
  }

</script>

<div class="log-page">
  <h1>Log Event</h1>

  {#if loading}
    <div class="loading">Loading schemas...</div>
  {:else}
    <form on:submit|preventDefault={handleSubmit}>
      {#if error}
        <div class="error-alert">{error}</div>
      {/if}

      {#if success}
        <div class="success-alert">{success}</div>
      {/if}

      <div class="form-section">
        <h2>Event Type</h2>

        <div class="schema-grid">
          {#each schemas as schema}
            <button
              type="button"
              class="schema-card"
              class:selected={selectedSchema?.id === schema.id}
              on:click={() => selectSchema(schema)}
            >
              <span class="schema-label">{schema.label}</span>
              <span class="schema-name">{schema.name}</span>
            </button>
          {/each}

          <button
            type="button"
            class="schema-card custom"
            class:selected={useCustomType}
            on:click={() => selectSchema(null)}
          >
            <span class="schema-label">Custom</span>
            <span class="schema-name">Enter type manually</span>
          </button>
        </div>

        {#if useCustomType}
          <div class="form-group">
            <label for="customType" class="label">Event Type Name</label>
            <input
              type="text"
              id="customType"
              class="input"
              bind:value={customEventType}
              placeholder="e.g., workout, meal, sleep"
              required
            />
          </div>
        {/if}
      </div>

      <div class="form-section">
        <h2>Timestamp</h2>
        <div class="form-group">
          <label for="timestamp" class="label">When did this happen?</label>
          <input
            type="datetime-local"
            id="timestamp"
            class="input"
            bind:value={timestamp}
          />
        </div>
      </div>

      {#if selectedSchema}
        <div class="form-section">
          <h2>Details</h2>
          {#each selectedSchema.fields as field}
            <div class="form-group">
              <label for={field.name} class="label">
                {field.label}
                {#if field.unit}
                  <span class="unit">({field.unit})</span>
                {/if}
                {#if field.required}
                  <span class="required">*</span>
                {/if}
              </label>

              {#if field.type === 'boolean'}
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    id={field.name}
                    checked={!!formData[field.name]}
                    on:change={(e) => (formData[field.name] = e.currentTarget.checked)}
                  />
                  <span>{field.label}</span>
                </label>
              {:else if field.type === 'number' || field.type === 'decimal'}
                <input
                  type="number"
                  id={field.name}
                  class="input"
                  step={field.type === 'decimal' ? '0.1' : '1'}
                  required={field.required}
                  value={formData[field.name] ?? ''}
                  on:input={(e) => (formData[field.name] = e.currentTarget.value)}
                />
              {:else if field.type === 'date'}
                <input
                  type="date"
                  id={field.name}
                  class="input"
                  required={field.required}
                  value={formData[field.name] ?? ''}
                  on:input={(e) => (formData[field.name] = e.currentTarget.value)}
                />
              {:else if field.type === 'datetime'}
                <input
                  type="datetime-local"
                  id={field.name}
                  class="input"
                  required={field.required}
                  value={formData[field.name] ?? ''}
                  on:input={(e) => (formData[field.name] = e.currentTarget.value)}
                />
              {:else}
                <input
                  type="text"
                  id={field.name}
                  class="input"
                  required={field.required}
                  value={formData[field.name] ?? ''}
                  on:input={(e) => (formData[field.name] = e.currentTarget.value)}
                />
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <div class="form-section">
        <div class="section-header">
          <h2>Custom Fields</h2>
          <button type="button" class="btn btn-secondary btn-sm" on:click={addCustomField}>
            + Add Field
          </button>
        </div>

        {#each customFields as field, index}
          <div class="custom-field-row">
            <input
              type="text"
              class="input"
              placeholder="Field name"
              bind:value={field.key}
            />
            <input
              type="text"
              class="input"
              placeholder="Value"
              bind:value={field.value}
            />
            <button
              type="button"
              class="remove-btn"
              on:click={() => removeCustomField(index)}
              aria-label="Remove field"
            >
              ×
            </button>
          </div>
        {/each}
      </div>

      <div class="form-section">
        <h2>Tags</h2>
        <div class="tags-input">
          <div class="tags-list">
            {#each tags as tag}
              <span class="tag">
                {tag}
                <button
                  type="button"
                  class="tag-remove"
                  on:click={() => removeTag(tag)}
                  aria-label="Remove tag"
                >
                  ×
                </button>
              </span>
            {/each}
          </div>
          <input
            type="text"
            class="input tag-input"
            placeholder="Add tag and press Enter"
            bind:value={tagInput}
            on:keydown={handleTagKeydown}
          />
        </div>
      </div>

      <button type="submit" class="btn btn-primary submit-btn" disabled={submitting}>
        {submitting ? 'Logging...' : 'Log Event'}
      </button>
    </form>
  {/if}
</div>

<style>
  .log-page {
    max-width: 600px;
    margin: 0 auto;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 1.5rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: var(--color-gray-500);
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
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 1rem;
    color: var(--color-gray-700);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .section-header h2 {
    margin: 0;
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
  }

  .schema-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .schema-card {
    padding: 0.875rem;
    border: 2px solid var(--color-gray-200);
    border-radius: 0.5rem;
    background-color: white;
    text-align: left;
    cursor: pointer;
    transition: border-color 0.15s, background-color 0.15s;
  }

  .schema-card:hover {
    border-color: var(--color-gray-300);
  }

  .schema-card.selected {
    border-color: var(--color-primary);
    background-color: rgb(59 130 246 / 0.05);
  }

  .schema-label {
    display: block;
    font-weight: 500;
    color: var(--color-gray-900);
    margin-bottom: 0.125rem;
  }

  .schema-name {
    display: block;
    font-size: 0.75rem;
    color: var(--color-gray-500);
  }

  .schema-card.custom .schema-label {
    color: var(--color-gray-600);
  }

  .unit {
    font-weight: 400;
    color: var(--color-gray-500);
  }

  .required {
    color: var(--color-danger);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .custom-field-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .custom-field-row .input {
    flex: 1;
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
  }

  .remove-btn:hover {
    background-color: var(--color-gray-200);
    color: var(--color-danger);
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-bottom: 0.5rem;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background-color: var(--color-gray-100);
    color: var(--color-gray-700);
    border-radius: 9999px;
    font-size: 0.875rem;
  }

  .tag-remove {
    background: none;
    border: none;
    color: var(--color-gray-400);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0;
  }

  .tag-remove:hover {
    color: var(--color-danger);
  }

  .submit-btn {
    width: 100%;
    padding: 0.875rem;
    font-size: 1rem;
  }
</style>
