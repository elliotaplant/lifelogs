<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { events as eventsApi, schemas as schemasApi, type Event, type EventSchema } from '$lib/api';
  import {
    createLineChart,
    eventsToChartData,
    eventsToMarkers,
    type ChartDataPoint,
    type EventMarker,
  } from '$lib/chart';
  import { subDays, startOfDay, endOfDay, format } from 'date-fns';

  let chartCanvas: HTMLCanvasElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chart: ReturnType<typeof createLineChart> | null = null;

  let eventTypes: string[] = [];
  let schemas: EventSchema[] = [];
  let allEvents: Event[] = [];
  let loading = true;
  let error = '';

  // Filters
  let selectedType = '';
  let markerTypes: string[] = [];
  let startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  let endDate = format(new Date(), 'yyyy-MM-dd');
  let valueField = '';

  // Available numeric fields from schema or data
  let availableFields: string[] = [];

  onMount(async () => {
    try {
      const [typesRes, schemasRes] = await Promise.all([
        eventsApi.listTypes(),
        schemasApi.list(),
      ]);

      eventTypes = typesRes.types;
      schemas = schemasRes.schemas;

      if (eventTypes.length > 0) {
        selectedType = eventTypes[0];
        updateAvailableFields();
        await loadEvents();
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load data';
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
    }
  });

  function updateAvailableFields() {
    const schema = schemas.find((s) => s.name === selectedType);
    if (schema) {
      availableFields = schema.fields
        .filter((f) => f.type === 'number' || f.type === 'decimal')
        .map((f) => f.name);
    } else {
      // Try to infer from existing events
      const typeEvents = allEvents.filter((e) => e.event_type === selectedType);
      const fieldSet = new Set<string>();
      for (const event of typeEvents) {
        if (event.data) {
          for (const [key, value] of Object.entries(event.data)) {
            if (typeof value === 'number') {
              fieldSet.add(key);
            }
          }
        }
      }
      availableFields = Array.from(fieldSet);
    }

    if (availableFields.length > 0 && !valueField) {
      valueField = availableFields[0];
    }
  }

  async function loadEvents() {
    if (!selectedType) return;

    loading = true;
    error = '';

    try {
      const start = startOfDay(new Date(startDate)).getTime();
      const end = endOfDay(new Date(endDate)).getTime();

      // Load main events
      const { events } = await eventsApi.list({
        event_type: selectedType,
        start,
        end,
        limit: 1000,
      });

      allEvents = events;
      updateAvailableFields();
      renderChart();

      // Load marker events
      if (markerTypes.length > 0) {
        const markerPromises = markerTypes.map((type) =>
          eventsApi.list({
            event_type: type,
            start,
            end,
            limit: 100,
          })
        );

        const markerResults = await Promise.all(markerPromises);
        const markerEvents = markerResults.flatMap((r) => r.events);
        renderChart(markerEvents);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load events';
    } finally {
      loading = false;
    }
  }

  function renderChart(markerEvents: Event[] = []) {
    if (!chartCanvas) return;

    // Destroy existing chart
    if (chart) {
      chart.destroy();
      chart = null;
    }

    if (allEvents.length === 0 || !valueField) {
      return;
    }

    const data = eventsToChartData(allEvents, valueField);
    const markers = eventsToMarkers(markerEvents, { color: '#ef4444' });

    const schema = schemas.find((s) => s.name === selectedType);
    const field = schema?.fields.find((f) => f.name === valueField);
    const yAxisLabel = field ? `${field.label}${field.unit ? ` (${field.unit})` : ''}` : valueField;

    chart = createLineChart(chartCanvas, data, {
      label: schema?.label || selectedType,
      color: schema?.color || '#3b82f6',
      markers,
      yAxisLabel,
    });
  }

  function handleTypeChange() {
    valueField = '';
    updateAvailableFields();
    loadEvents();
  }

  function toggleMarkerType(type: string) {
    if (markerTypes.includes(type)) {
      markerTypes = markerTypes.filter((t) => t !== type);
    } else {
      markerTypes = [...markerTypes, type];
    }
    loadEvents();
  }
</script>

<div class="charts-page">
  <h1>Visualization</h1>

  <div class="filters-section">
    <div class="filter-row">
      <div class="filter-group">
        <label for="eventType" class="label">Event Type</label>
        <select
          id="eventType"
          class="input"
          bind:value={selectedType}
          on:change={handleTypeChange}
        >
          {#each eventTypes as type}
            <option value={type}>{schemas.find((s) => s.name === type)?.label || type}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="valueField" class="label">Value Field</label>
        <select
          id="valueField"
          class="input"
          bind:value={valueField}
          on:change={() => renderChart()}
        >
          {#each availableFields as field}
            <option value={field}>{field}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="startDate" class="label">Start Date</label>
        <input
          type="date"
          id="startDate"
          class="input"
          bind:value={startDate}
          on:change={loadEvents}
        />
      </div>

      <div class="filter-group">
        <label for="endDate" class="label">End Date</label>
        <input
          type="date"
          id="endDate"
          class="input"
          bind:value={endDate}
          on:change={loadEvents}
        />
      </div>
    </div>

    {#if eventTypes.length > 1}
      <div class="markers-section">
        <span class="label">Event Markers</span>
        <div class="marker-options">
          {#each eventTypes.filter((t) => t !== selectedType) as type}
            <label class="marker-option">
              <input
                type="checkbox"
                checked={markerTypes.includes(type)}
                on:change={() => toggleMarkerType(type)}
              />
              <span>{schemas.find((s) => s.name === type)?.label || type}</span>
            </label>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  {#if loading}
    <div class="loading">Loading chart data...</div>
  {:else if error}
    <div class="error-message">{error}</div>
  {:else if eventTypes.length === 0}
    <div class="empty-state">
      <h2>No events to visualize</h2>
      <p>Log some events first to see them visualized here.</p>
      <a href="/log" class="btn btn-primary">Log Event</a>
    </div>
  {:else if allEvents.length === 0}
    <div class="empty-state">
      <h2>No data in selected range</h2>
      <p>Try adjusting the date range or selecting a different event type.</p>
    </div>
  {:else if availableFields.length === 0}
    <div class="empty-state">
      <h2>No numeric fields</h2>
      <p>This event type doesn't have numeric data to chart.</p>
    </div>
  {:else}
    <div class="chart-container">
      <canvas bind:this={chartCanvas}></canvas>
    </div>

    <div class="stats-section">
      <div class="stat-card">
        <span class="stat-value">{allEvents.length}</span>
        <span class="stat-label">Total Events</span>
      </div>
      {#if allEvents.length > 0 && valueField}
        {@const values = allEvents
          .filter((e) => e.data && typeof e.data[valueField] === 'number')
          .map((e) => Number(e.data?.[valueField]))}
        {#if values.length > 0}
          <div class="stat-card">
            <span class="stat-value">{Math.min(...values).toFixed(1)}</span>
            <span class="stat-label">Min</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{Math.max(...values).toFixed(1)}</span>
            <span class="stat-label">Max</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">
              {(values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)}
            </span>
            <span class="stat-label">Average</span>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .charts-page {
    max-width: 1000px;
    margin: 0 auto;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 1.5rem;
  }

  .filters-section {
    background-color: white;
    padding: 1rem;
    border-radius: 0.75rem;
    box-shadow: var(--shadow);
    margin-bottom: 1rem;
  }

  .filter-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
  }

  .markers-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-gray-200);
  }

  .markers-section .label {
    display: block;
    margin-bottom: 0.5rem;
  }

  .marker-options {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .marker-option {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .loading {
    text-align: center;
    padding: 3rem;
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

  .chart-container {
    background-color: white;
    padding: 1rem;
    border-radius: 0.75rem;
    box-shadow: var(--shadow);
    height: 400px;
    margin-bottom: 1rem;
  }

  .stats-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 0.75rem;
  }

  .stat-card {
    background-color: white;
    padding: 1rem;
    border-radius: 0.5rem;
    box-shadow: var(--shadow-sm);
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-primary);
  }

  .stat-label {
    font-size: 0.75rem;
    color: var(--color-gray-500);
    text-transform: uppercase;
  }
</style>
