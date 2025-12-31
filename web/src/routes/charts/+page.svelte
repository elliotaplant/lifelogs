<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { events as eventsApi, type Event } from '$lib/api';
  import { createLineChart, eventsToChartData, eventsToMarkers } from '$lib/chart';
  import { subDays, format } from 'date-fns';

  let chartCanvas: HTMLCanvasElement;
  let chart: ReturnType<typeof createLineChart> | null = null;

  let eventTypes: string[] = [];
  let allEvents: Event[] = [];
  let loading = true;
  let error = '';

  // Filters
  let selectedType = '';
  let markerTypes: string[] = [];
  let startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  let endDate = format(new Date(), 'yyyy-MM-dd');
  let valueField = '';

  // Available numeric fields from data
  let availableFields: string[] = [];

  onMount(async () => {
    try {
      const typesRes = await eventsApi.listTypes();
      eventTypes = typesRes.types;

      if (eventTypes.length > 0) {
        selectedType = eventTypes[0];
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
    // Infer numeric fields from existing events
    const typeEvents = allEvents.filter((e) => e.event_type === selectedType);
    const fieldSet = new Set<string>();
    for (const event of typeEvents) {
      if (event.data) {
        for (const [key, value] of Object.entries(event.data)) {
          // Check if value is numeric or can be parsed as number
          if (typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)))) {
            fieldSet.add(key);
          }
        }
      }
    }
    availableFields = Array.from(fieldSet);

    if (availableFields.length > 0 && !availableFields.includes(valueField)) {
      valueField = availableFields[0];
    }
  }

  async function loadEvents() {
    if (!selectedType) return;

    loading = true;
    error = '';

    try {
      // First load all events of this type, then filter client-side if needed
      const { events } = await eventsApi.list({
        event_type: selectedType,
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

  async function renderChart(markerEvents: Event[] = []) {
    // Wait for DOM to update so canvas is bound
    await tick();

    if (!chartCanvas) return;

    if (chart) {
      chart.destroy();
      chart = null;
    }

    if (allEvents.length === 0 || !valueField) {
      return;
    }

    // Convert string values to numbers for charting
    const eventsWithNumbers = allEvents.map((e) => ({
      ...e,
      data: e.data
        ? Object.fromEntries(
            Object.entries(e.data).map(([k, v]) => [
              k,
              typeof v === 'string' ? parseFloat(v) : v,
            ])
          )
        : null,
    }));

    const data = eventsToChartData(eventsWithNumbers as Event[], valueField);
    const markers = eventsToMarkers(markerEvents, { color: '#ef4444' });

    chart = createLineChart(chartCanvas, data, {
      label: selectedType,
      color: '#3b82f6',
      markers,
      yAxisLabel: valueField,
    });
  }

  function handleTypeChange() {
    valueField = '';
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

  function getNumericValues(): number[] {
    return allEvents
      .filter((e) => e.data && e.data[valueField] !== undefined)
      .map((e) => {
        const val = e.data![valueField];
        return typeof val === 'string' ? parseFloat(val) : (val as number);
      })
      .filter((v) => !isNaN(v));
  }
</script>

<div class="charts-page">
  <h1>Charts</h1>

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
            <option value={type}>{type}</option>
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
          on:change={() => loadEvents()}
        />
      </div>

      <div class="filter-group">
        <label for="endDate" class="label">End Date</label>
        <input
          type="date"
          id="endDate"
          class="input"
          bind:value={endDate}
          on:change={() => loadEvents()}
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
              <span>{type}</span>
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
      <p>This event type doesn't have numeric data to chart. Add numeric values to your events.</p>
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
        {@const values = getNumericValues()}
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
