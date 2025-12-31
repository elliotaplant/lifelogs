import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import 'chartjs-adapter-date-fns';
import type { Event } from './api';

// Register Chart.js components
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
);

export interface ChartDataPoint {
  x: Date;
  y: number;
}

export interface EventMarker {
  timestamp: number;
  label: string;
  color?: string;
}

export function createLineChart(
  canvas: HTMLCanvasElement,
  data: ChartDataPoint[],
  options?: {
    label?: string;
    color?: string;
    markers?: EventMarker[];
    yAxisLabel?: string;
  }
) {
  const color = options?.color || '#3b82f6';

  const annotations: Record<string, object> = {};

  if (options?.markers) {
    options.markers.forEach((marker, index) => {
      annotations[`marker${index}`] = {
        type: 'line',
        scaleID: 'x',
        value: new Date(marker.timestamp),
        borderColor: marker.color || '#ef4444',
        borderWidth: 2,
        borderDash: [5, 5],
        label: {
          display: true,
          content: marker.label,
          position: 'start',
          backgroundColor: marker.color || '#ef4444',
          color: 'white',
          font: {
            size: 11,
          },
          padding: 4,
        },
      };
    });
  }

  return new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [
        {
          label: options?.label || 'Value',
          data: data,
          borderColor: color,
          backgroundColor: `${color}30`,
          fill: true,
          tension: 0.3,
          pointRadius: 8,
          pointHoverRadius: 10,
          pointBackgroundColor: color,
          borderWidth: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      scales: {
        x: {
          type: 'time',
          time: {
            tooltipFormat: 'PPpp',
            displayFormats: {
              hour: 'HH:mm',
              day: 'MMM d',
              week: 'MMM d',
              month: 'MMM yyyy',
            },
          },
          title: {
            display: true,
            text: 'Date',
          },
        },
        y: {
          beginAtZero: false,
          title: {
            display: !!options?.yAxisLabel,
            text: options?.yAxisLabel,
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        annotation: {
          annotations,
        },
      },
    },
  });
}

export function eventsToChartData(
  events: Event[],
  valueField: string
): ChartDataPoint[] {
  return events
    .filter((event) => {
      const value = event.data?.[valueField];
      return value !== undefined && value !== null && typeof value === 'number';
    })
    .map((event) => ({
      x: new Date(event.timestamp),
      y: event.data![valueField] as number,
    }))
    .sort((a, b) => a.x.getTime() - b.x.getTime());
}

export function eventsToMarkers(
  events: Event[],
  options?: { labelField?: string; color?: string }
): EventMarker[] {
  return events.map((event) => ({
    timestamp: event.timestamp,
    label:
      options?.labelField && event.data?.[options.labelField]
        ? String(event.data[options.labelField])
        : event.event_type,
    color: options?.color,
  }));
}
