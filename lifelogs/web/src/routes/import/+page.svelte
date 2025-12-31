<script lang="ts">
  import { importApi } from '$lib/api';

  type ImportMode = 'json' | 'csv';

  let mode: ImportMode = 'json';
  let fileInput: HTMLInputElement;
  let fileName = '';
  let fileContent = '';
  let manualInput = '';

  let loading = false;
  let error = '';
  let result: { imported: number; total: number; errors: string[] } | null = null;

  let csvPreview: {
    valid: boolean;
    error?: string;
    columns?: string[];
    total_rows?: number;
    preview?: Array<{
      line: number;
      timestamp: string | number;
      event_type: string;
      data: unknown;
      tags: unknown;
      error?: string;
    }>;
  } | null = null;

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    fileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      fileContent = e.target?.result as string;
      if (mode === 'csv') {
        previewCsv();
      }
    };
    reader.readAsText(file);
  }

  async function previewCsv() {
    const content = fileContent || manualInput;
    if (!content.trim()) return;

    try {
      csvPreview = await importApi.previewCsv(content);
    } catch (err) {
      csvPreview = {
        valid: false,
        error: err instanceof Error ? err.message : 'Preview failed',
      };
    }
  }

  async function handleImport() {
    error = '';
    result = null;

    const content = fileContent || manualInput;
    if (!content.trim()) {
      error = 'Please provide content to import';
      return;
    }

    loading = true;

    try {
      if (mode === 'json') {
        const parsed = JSON.parse(content);
        const events = parsed.events || (Array.isArray(parsed) ? parsed : [parsed]);
        result = await importApi.json(events);
      } else {
        result = await importApi.csv(content);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Import failed';
    } finally {
      loading = false;
    }
  }

  function clearForm() {
    fileName = '';
    fileContent = '';
    manualInput = '';
    error = '';
    result = null;
    csvPreview = null;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  function switchMode(newMode: ImportMode) {
    mode = newMode;
    clearForm();
  }
</script>

<div class="import-page">
  <h1>Import Events</h1>

  <div class="mode-tabs">
    <button
      class="mode-tab"
      class:active={mode === 'json'}
      on:click={() => switchMode('json')}
    >
      JSON
    </button>
    <button
      class="mode-tab"
      class:active={mode === 'csv'}
      on:click={() => switchMode('csv')}
    >
      CSV
    </button>
  </div>

  <div class="import-section">
    <div class="file-upload">
      <input
        type="file"
        accept={mode === 'json' ? '.json' : '.csv'}
        bind:this={fileInput}
        on:change={handleFileSelect}
        id="fileInput"
      />
      <label for="fileInput" class="file-label">
        <span class="file-icon">📄</span>
        {#if fileName}
          <span class="file-name">{fileName}</span>
        {:else}
          <span>Choose a {mode.toUpperCase()} file</span>
        {/if}
      </label>
    </div>

    <div class="divider">
      <span>or paste content directly</span>
    </div>

    <textarea
      class="input manual-input"
      placeholder={mode === 'json'
        ? '{\n  "events": [\n    {\n      "timestamp": "2024-01-15T08:30:00Z",\n      "event_type": "weight",\n      "data": {"value_lbs": 198.8},\n      "tags": ["health"]\n    }\n  ]\n}'
        : 'timestamp,event_type,data,tags\n2024-01-15T08:30:00Z,weight,"{""value_lbs"":198.8}","[""health""]"'}
      bind:value={manualInput}
      on:blur={() => mode === 'csv' && manualInput && previewCsv()}
      rows="10"
    ></textarea>
  </div>

  {#if mode === 'csv' && csvPreview}
    <div class="preview-section">
      <h2>Preview</h2>
      {#if !csvPreview.valid}
        <div class="error-alert">{csvPreview.error}</div>
      {:else}
        <p class="preview-info">
          Columns: {csvPreview.columns?.join(', ')} |
          Total rows: {csvPreview.total_rows}
        </p>
        <div class="preview-table-wrapper">
          <table class="preview-table">
            <thead>
              <tr>
                <th>Line</th>
                <th>Timestamp</th>
                <th>Event Type</th>
                <th>Data</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {#each csvPreview.preview || [] as row}
                <tr class:error-row={row.error}>
                  <td>{row.line}</td>
                  <td>{row.timestamp}</td>
                  <td>{row.event_type}</td>
                  <td>
                    {#if row.error}
                      <span class="error-text">{row.error}</span>
                    {:else}
                      {JSON.stringify(row.data)}
                    {/if}
                  </td>
                  <td>{JSON.stringify(row.tags)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}

  {#if error}
    <div class="error-alert">{error}</div>
  {/if}

  {#if result}
    <div class="result-section" class:success={result.errors.length === 0}>
      <h2>Import Complete</h2>
      <p>
        Successfully imported <strong>{result.imported}</strong> of
        <strong>{result.total}</strong> events.
      </p>

      {#if result.errors.length > 0}
        <details class="errors-details">
          <summary>{result.errors.length} errors occurred</summary>
          <ul class="errors-list">
            {#each result.errors as err}
              <li>{err}</li>
            {/each}
          </ul>
        </details>
      {/if}
    </div>
  {/if}

  <div class="actions">
    <button
      class="btn btn-primary"
      on:click={handleImport}
      disabled={loading || (!fileContent && !manualInput)}
    >
      {loading ? 'Importing...' : 'Import Events'}
    </button>
    <button class="btn btn-secondary" on:click={clearForm}>
      Clear
    </button>
  </div>

  <div class="format-help">
    <h2>Format Guide</h2>

    {#if mode === 'json'}
      <div class="format-example">
        <h3>JSON Format</h3>
        <pre>{`{
  "events": [
    {
      "timestamp": "2024-01-15T08:30:00Z",
      "event_type": "weight",
      "data": {"value_lbs": 198.8},
      "tags": ["health"]
    }
  ]
}`}</pre>
        <p>You can also provide an array directly without the "events" wrapper.</p>
      </div>
    {:else}
      <div class="format-example">
        <h3>CSV Format</h3>
        <p>Required columns: <code>timestamp</code>, <code>event_type</code></p>
        <p>Optional columns: <code>data</code> (JSON object), <code>tags</code> (JSON array)</p>
        <pre>timestamp,event_type,data,tags
2024-01-15T08:30:00Z,weight,"{'{'}""value_lbs"":198.8{'}'}","[""health""]"
2024-01-16T08:30:00Z,mood,"{'{'}""score"":7{'}'}","[""health""]"</pre>
      </div>
    {/if}
  </div>
</div>

<style>
  .import-page {
    max-width: 800px;
    margin: 0 auto;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 1.5rem;
  }

  .mode-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .mode-tab {
    padding: 0.625rem 1.25rem;
    border: 1px solid var(--color-gray-300);
    background-color: white;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .mode-tab:hover {
    background-color: var(--color-gray-50);
  }

  .mode-tab.active {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  .import-section {
    background-color: white;
    padding: 1.5rem;
    border-radius: 0.75rem;
    box-shadow: var(--shadow);
    margin-bottom: 1rem;
  }

  .file-upload input {
    display: none;
  }

  .file-label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1.5rem;
    border: 2px dashed var(--color-gray-300);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: border-color 0.15s, background-color 0.15s;
  }

  .file-label:hover {
    border-color: var(--color-primary);
    background-color: rgb(59 130 246 / 0.05);
  }

  .file-icon {
    font-size: 1.5rem;
  }

  .file-name {
    font-weight: 500;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 1rem 0;
    color: var(--color-gray-500);
    font-size: 0.875rem;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background-color: var(--color-gray-200);
  }

  .manual-input {
    resize: vertical;
    font-family: monospace;
    font-size: 0.875rem;
  }

  .preview-section {
    background-color: white;
    padding: 1rem;
    border-radius: 0.75rem;
    box-shadow: var(--shadow);
    margin-bottom: 1rem;
  }

  .preview-section h2 {
    font-size: 1rem;
    margin: 0 0 0.75rem;
  }

  .preview-info {
    font-size: 0.875rem;
    color: var(--color-gray-500);
    margin: 0 0 0.75rem;
  }

  .preview-table-wrapper {
    overflow-x: auto;
  }

  .preview-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .preview-table th,
  .preview-table td {
    padding: 0.5rem;
    border: 1px solid var(--color-gray-200);
    text-align: left;
  }

  .preview-table th {
    background-color: var(--color-gray-50);
    font-weight: 600;
  }

  .error-row {
    background-color: rgb(239 68 68 / 0.05);
  }

  .error-alert {
    background-color: rgb(239 68 68 / 0.1);
    color: var(--color-danger);
    padding: 0.75rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }

  .result-section {
    background-color: white;
    padding: 1rem;
    border-radius: 0.75rem;
    box-shadow: var(--shadow);
    margin-bottom: 1rem;
    border-left: 4px solid var(--color-warning);
  }

  .result-section.success {
    border-left-color: var(--color-success);
  }

  .result-section h2 {
    font-size: 1rem;
    margin: 0 0 0.5rem;
  }

  .result-section p {
    margin: 0;
  }

  .errors-details {
    margin-top: 0.75rem;
  }

  .errors-details summary {
    cursor: pointer;
    color: var(--color-danger);
    font-size: 0.875rem;
  }

  .errors-list {
    margin: 0.5rem 0 0;
    padding-left: 1.25rem;
    font-size: 0.75rem;
    color: var(--color-gray-600);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
  }

  .format-help {
    background-color: white;
    padding: 1.5rem;
    border-radius: 0.75rem;
    box-shadow: var(--shadow);
  }

  .format-help h2 {
    font-size: 1rem;
    margin: 0 0 1rem;
  }

  .format-example h3 {
    font-size: 0.875rem;
    margin: 0 0 0.5rem;
  }

  .format-example p {
    font-size: 0.875rem;
    color: var(--color-gray-600);
    margin: 0 0 0.5rem;
  }

  .format-example pre {
    background-color: var(--color-gray-50);
    padding: 0.75rem;
    border-radius: 0.375rem;
    overflow-x: auto;
    font-size: 0.75rem;
    margin: 0;
  }

  .format-example code {
    background-color: var(--color-gray-100);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
  }
</style>
