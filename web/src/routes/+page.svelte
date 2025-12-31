<script lang="ts">
  import { onMount } from 'svelte';
  import { events as eventsApi, type Event } from '$lib/api';
  import { format } from 'date-fns';

  let recentEvents: Event[] = [];
  let loading = true;
  let error = '';

  onMount(async () => {
    try {
      const { events } = await eventsApi.list({ limit: 20 });
      recentEvents = events;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load events';
    } finally {
      loading = false;
    }
  });

  async function deleteEvent(id: string) {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      await eventsApi.delete(id);
      recentEvents = recentEvents.filter((e) => e.id !== id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete event');
    }
  }

  function formatTimestamp(ts: number): string {
    return format(new Date(ts), 'MMM d, yyyy h:mm a');
  }

  function getPrimaryValue(event: Event): string {
    if (!event.data) return '';
    const values = Object.entries(event.data);
    if (values.length === 0) return '';
    const [key, value] = values[0];
    if (typeof value === 'number') {
      return `${key}: ${value}`;
    }
    return `${key}: ${String(value)}`;
  }
</script>

<div class="dashboard">
  <div class="page-header">
    <h1>Dashboard</h1>
    <a href="/log" class="btn btn-primary">Log Event</a>
  </div>

  {#if loading}
    <div class="loading">Loading events...</div>
  {:else if error}
    <div class="error-message">{error}</div>
  {:else if recentEvents.length === 0}
    <div class="empty-state">
      <h2>No events yet</h2>
      <p>Start logging your first event to track your life.</p>
      <a href="/log" class="btn btn-primary">Log Your First Event</a>
    </div>
  {:else}
    <div class="events-section">
      <h2>Recent Events</h2>
      <div class="events-list">
        {#each recentEvents as event (event.id)}
          <div class="event-card">
            <div class="event-header">
              <span class="event-type">{event.event_type}</span>
              <span class="event-time">{formatTimestamp(event.timestamp)}</span>
            </div>

            {#if event.data}
              <div class="event-data">
                {#each Object.entries(event.data) as [key, value]}
                  <span class="data-item">
                    <span class="data-key">{key}:</span>
                    <span class="data-value">{value}</span>
                  </span>
                {/each}
              </div>
            {/if}

            {#if event.tags && event.tags.length > 0}
              <div class="event-tags">
                {#each event.tags as tag}
                  <span class="tag">{tag}</span>
                {/each}
              </div>
            {/if}

            <div class="event-actions">
              <span class="event-source">{event.source}</span>
              <button
                class="delete-btn"
                on:click={() => deleteEvent(event.id)}
                aria-label="Delete event"
              >
                Delete
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .dashboard {
    max-width: 800px;
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
    text-align: center;
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

  .events-section h2 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 1rem;
  }

  .events-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .event-card {
    background-color: white;
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--color-gray-200);
  }

  .event-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .event-type {
    font-weight: 600;
    color: var(--color-primary);
  }

  .event-time {
    font-size: 0.875rem;
    color: var(--color-gray-500);
  }

  @media (max-width: 480px) {
    .event-header {
      flex-direction: column;
      align-items: flex-start;
    }
  }

  .event-data {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .data-item {
    font-size: 0.875rem;
  }

  .data-key {
    color: var(--color-gray-500);
  }

  .data-value {
    color: var(--color-gray-900);
    font-weight: 500;
  }

  .event-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-bottom: 0.5rem;
  }

  .tag {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    background-color: var(--color-gray-100);
    color: var(--color-gray-600);
    border-radius: 9999px;
  }

  .event-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-gray-100);
  }

  .event-source {
    font-size: 0.75rem;
    color: var(--color-gray-400);
  }

  .delete-btn {
    font-size: 0.75rem;
    color: var(--color-danger);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
  }

  .delete-btn:hover {
    background-color: rgb(239 68 68 / 0.1);
  }
</style>
