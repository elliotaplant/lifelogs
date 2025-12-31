<script lang="ts">
  import { onMount } from 'svelte';
  import {
    schemas as schemasApi,
    type EventSchema,
    type FieldDefinition,
  } from '$lib/api';

  let schemas: EventSchema[] = [];
  let loading = true;
  let error = '';

  let showForm = false;
  let editingSchema: EventSchema | null = null;

  // Form state
  let formName = '';
  let formLabel = '';
  let formFields: FieldDefinition[] = [];
  let formIcon = '';
  let formColor = '#3b82f6';
  let formDefaultTags: string[] = [];
  let formTagInput = '';
  let formSubmitting = false;
  let formError = '';

  onMount(async () => {
    await loadSchemas();
  });

  async function loadSchemas() {
    try {
      const { schemas: s } = await schemasApi.list();
      schemas = s;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load schemas';
    } finally {
      loading = false;
    }
  }

  function openCreateForm() {
    editingSchema = null;
    formName = '';
    formLabel = '';
    formFields = [
      { name: 'value', label: 'Value', type: 'number', required: true, primary: true },
    ];
    formIcon = '';
    formColor = '#3b82f6';
    formDefaultTags = [];
    formError = '';
    showForm = true;
  }

  function openEditForm(schema: EventSchema) {
    editingSchema = schema;
    formName = schema.name;
    formLabel = schema.label;
    formFields = [...schema.fields];
    formIcon = schema.icon || '';
    formColor = schema.color || '#3b82f6';
    formDefaultTags = [...schema.default_tags];
    formError = '';
    showForm = true;
  }

  function closeForm() {
    showForm = false;
    editingSchema = null;
  }

  function addField() {
    formFields = [
      ...formFields,
      { name: '', label: '', type: 'string', required: false },
    ];
  }

  function removeField(index: number) {
    formFields = formFields.filter((_, i) => i !== index);
  }

  function addDefaultTag() {
    const tag = formTagInput.trim();
    if (tag && !formDefaultTags.includes(tag)) {
      formDefaultTags = [...formDefaultTags, tag];
      formTagInput = '';
    }
  }

  function removeDefaultTag(tag: string) {
    formDefaultTags = formDefaultTags.filter((t) => t !== tag);
  }

  async function handleSubmit() {
    formError = '';

    // Validate
    if (!formName.match(/^[a-z0-9_]+$/)) {
      formError = 'Name must be lowercase letters, numbers, and underscores only';
      return;
    }

    if (formFields.length === 0) {
      formError = 'At least one field is required';
      return;
    }

    for (const field of formFields) {
      if (!field.name || !field.label) {
        formError = 'All fields must have a name and label';
        return;
      }
    }

    formSubmitting = true;

    try {
      if (editingSchema) {
        await schemasApi.update(editingSchema.id, {
          label: formLabel,
          fields: formFields,
          icon: formIcon || undefined,
          color: formColor,
          default_tags: formDefaultTags,
        });
      } else {
        await schemasApi.create({
          name: formName,
          label: formLabel,
          fields: formFields,
          icon: formIcon || undefined,
          color: formColor,
          default_tags: formDefaultTags,
        });
      }

      await loadSchemas();
      closeForm();
    } catch (err) {
      formError = err instanceof Error ? err.message : 'Failed to save schema';
    } finally {
      formSubmitting = false;
    }
  }

  async function deleteSchema(id: string) {
    if (!confirm('Are you sure you want to delete this schema?')) return;

    try {
      await schemasApi.delete(id);
      schemas = schemas.filter((s) => s.id !== id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete schema');
    }
  }
</script>

<div class="schemas-page">
  <div class="page-header">
    <h1>Event Schemas</h1>
    <button class="btn btn-primary" on:click={openCreateForm}>
      + New Schema
    </button>
  </div>

  {#if loading}
    <div class="loading">Loading schemas...</div>
  {:else if error}
    <div class="error-message">{error}</div>
  {:else if schemas.length === 0}
    <div class="empty-state">
      <h2>No schemas yet</h2>
      <p>Create a schema to define reusable event types with custom fields.</p>
      <button class="btn btn-primary" on:click={openCreateForm}>
        Create Your First Schema
      </button>
    </div>
  {:else}
    <div class="schemas-grid">
      {#each schemas as schema (schema.id)}
        <div class="schema-card">
          <div class="schema-header" style="border-color: {schema.color || '#3b82f6'}">
            <h3>{schema.label}</h3>
            <span class="schema-name">{schema.name}</span>
          </div>

          <div class="schema-fields">
            <h4>Fields</h4>
            <ul>
              {#each schema.fields as field}
                <li>
                  <span class="field-label">{field.label}</span>
                  <span class="field-type">{field.type}</span>
                  {#if field.required}
                    <span class="field-required">required</span>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>

          {#if schema.default_tags.length > 0}
            <div class="schema-tags">
              {#each schema.default_tags as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          {/if}

          <div class="schema-actions">
            <button class="btn btn-secondary" on:click={() => openEditForm(schema)}>
              Edit
            </button>
            <button class="btn btn-danger" on:click={() => deleteSchema(schema.id)}>
              Delete
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showForm}
  <div class="modal-overlay" on:click={closeForm} on:keydown={(e) => e.key === 'Escape' && closeForm()}>
    <div class="modal" on:click|stopPropagation role="dialog" aria-modal="true">
      <h2>{editingSchema ? 'Edit Schema' : 'New Schema'}</h2>

      <form on:submit|preventDefault={handleSubmit}>
        {#if formError}
          <div class="error-alert">{formError}</div>
        {/if}

        <div class="form-group">
          <label for="schemaName" class="label">Name</label>
          <input
            type="text"
            id="schemaName"
            class="input"
            bind:value={formName}
            placeholder="e.g., weight_measurement"
            pattern="^[a-z0-9_]+$"
            required
            disabled={!!editingSchema}
          />
          <span class="hint">Lowercase letters, numbers, and underscores only</span>
        </div>

        <div class="form-group">
          <label for="schemaLabel" class="label">Label</label>
          <input
            type="text"
            id="schemaLabel"
            class="input"
            bind:value={formLabel}
            placeholder="e.g., Weight Measurement"
            required
          />
        </div>

        <div class="form-group">
          <label for="schemaColor" class="label">Color</label>
          <input
            type="color"
            id="schemaColor"
            class="color-input"
            bind:value={formColor}
          />
        </div>

        <div class="form-section">
          <div class="section-header">
            <h3>Fields</h3>
            <button type="button" class="btn btn-secondary btn-sm" on:click={addField}>
              + Add Field
            </button>
          </div>

          {#each formFields as field, index}
            <div class="field-row">
              <input
                type="text"
                class="input"
                placeholder="Field name"
                bind:value={field.name}
                pattern="^[a-z0-9_]+$"
              />
              <input
                type="text"
                class="input"
                placeholder="Label"
                bind:value={field.label}
              />
              <select class="input" bind:value={field.type}>
                <option value="string">Text</option>
                <option value="number">Number</option>
                <option value="decimal">Decimal</option>
                <option value="boolean">Boolean</option>
                <option value="date">Date</option>
                <option value="datetime">Date/Time</option>
              </select>
              <label class="checkbox-inline">
                <input type="checkbox" bind:checked={field.required} />
                Required
              </label>
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
        </div>

        <div class="form-group">
          <label class="label">Default Tags</label>
          <div class="tags-list">
            {#each formDefaultTags as tag}
              <span class="tag">
                {tag}
                <button
                  type="button"
                  class="tag-remove"
                  on:click={() => removeDefaultTag(tag)}
                >
                  ×
                </button>
              </span>
            {/each}
          </div>
          <div class="tag-input-row">
            <input
              type="text"
              class="input"
              placeholder="Add tag"
              bind:value={formTagInput}
              on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addDefaultTag())}
            />
            <button type="button" class="btn btn-secondary" on:click={addDefaultTag}>
              Add
            </button>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" on:click={closeForm}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={formSubmitting}>
            {formSubmitting ? 'Saving...' : 'Save Schema'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .schemas-page {
    max-width: 1000px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .page-header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: var(--color-gray-500);
  }

  .error-message {
    background-color: rgb(239 68 68 / 0.1);
    color: var(--color-danger);
    padding: 1rem;
    border-radius: 0.5rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    background-color: white;
    border-radius: 0.75rem;
    box-shadow: var(--shadow);
  }

  .empty-state h2 {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
  }

  .empty-state p {
    color: var(--color-gray-500);
    margin: 0 0 1.5rem;
  }

  .schemas-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }

  .schema-card {
    background-color: white;
    border-radius: 0.75rem;
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .schema-header {
    padding: 1rem;
    border-left: 4px solid;
  }

  .schema-header h3 {
    margin: 0;
    font-size: 1.125rem;
  }

  .schema-name {
    font-size: 0.875rem;
    color: var(--color-gray-500);
  }

  .schema-fields {
    padding: 0 1rem;
  }

  .schema-fields h4 {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--color-gray-500);
    margin: 0 0 0.5rem;
  }

  .schema-fields ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .schema-fields li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0;
    font-size: 0.875rem;
  }

  .field-label {
    font-weight: 500;
  }

  .field-type {
    color: var(--color-gray-500);
    font-size: 0.75rem;
  }

  .field-required {
    color: var(--color-primary);
    font-size: 0.625rem;
    text-transform: uppercase;
  }

  .schema-tags {
    padding: 0.5rem 1rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    background-color: var(--color-gray-100);
    color: var(--color-gray-600);
    border-radius: 9999px;
    font-size: 0.75rem;
  }

  .tag-remove {
    background: none;
    border: none;
    color: var(--color-gray-400);
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .tag-remove:hover {
    color: var(--color-danger);
  }

  .schema-actions {
    padding: 1rem;
    display: flex;
    gap: 0.5rem;
    border-top: 1px solid var(--color-gray-100);
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 200;
  }

  .modal {
    background-color: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal h2 {
    margin: 0 0 1.5rem;
    font-size: 1.25rem;
  }

  .error-alert {
    background-color: rgb(239 68 68 / 0.1);
    color: var(--color-danger);
    padding: 0.75rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }

  .hint {
    font-size: 0.75rem;
    color: var(--color-gray-500);
    margin-top: 0.25rem;
  }

  .color-input {
    width: 60px;
    height: 36px;
    padding: 2px;
    border: 1px solid var(--color-gray-300);
    border-radius: 0.375rem;
    cursor: pointer;
  }

  .form-section {
    margin-bottom: 1rem;
    padding: 1rem;
    background-color: var(--color-gray-50);
    border-radius: 0.5rem;
  }

  .form-section h3 {
    font-size: 0.875rem;
    margin: 0;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr 100px auto auto;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    align-items: center;
  }

  .checkbox-inline {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .remove-btn {
    width: 28px;
    height: 28px;
    border: none;
    background-color: var(--color-gray-200);
    color: var(--color-gray-500);
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
  }

  .remove-btn:hover {
    background-color: var(--color-gray-300);
    color: var(--color-danger);
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-bottom: 0.5rem;
  }

  .tag-input-row {
    display: flex;
    gap: 0.5rem;
  }

  .tag-input-row .input {
    flex: 1;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }

  @media (max-width: 640px) {
    .field-row {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
