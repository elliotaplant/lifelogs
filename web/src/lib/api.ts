const API_BASE = '/api';

export interface User {
  id: string;
  email: string;
  email_verified: number;
}

export interface Event {
  id: string;
  user_id: string;
  timestamp: number;
  event_type: string;
  data: Record<string, unknown> | null;
  tags: string[];
  source: string;
  created_at: number;
}

export interface EventSchema {
  id: string;
  user_id: string;
  name: string;
  label: string;
  fields: FieldDefinition[];
  icon: string | null;
  color: string | null;
  default_tags: string[];
  created_at: number;
}

export interface FieldDefinition {
  name: string;
  label: string;
  type: 'string' | 'number' | 'decimal' | 'boolean' | 'date' | 'datetime';
  required?: boolean;
  primary?: boolean;
  unit?: string;
}

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(data.error || 'Request failed', response.status);
  }

  return data;
}

// Auth API
export const auth = {
  async register(email: string, password: string): Promise<{ user: User }> {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async login(email: string, password: string): Promise<{ user: User }> {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async logout(): Promise<{ success: boolean }> {
    return request('/auth/logout', { method: 'POST' });
  },

  async me(): Promise<{ user: User }> {
    return request('/auth/me');
  },

  async forgotPassword(email: string): Promise<{ success: boolean }> {
    return request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(
    token: string,
    password: string
  ): Promise<{ success: boolean }> {
    return request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },
};

// Events API
export const events = {
  async list(params?: {
    event_type?: string;
    start?: number;
    end?: number;
    tags?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    events: Event[];
    meta: { limit: number; offset: number; count: number };
  }> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return request(`/events${query ? `?${query}` : ''}`);
  },

  async get(id: string): Promise<{ event: Event }> {
    return request(`/events/${id}`);
  },

  async create(data: {
    timestamp?: number;
    event_type: string;
    data?: Record<string, unknown>;
    tags?: string[];
  }): Promise<{ event: Event }> {
    return request('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(
    id: string,
    data: {
      timestamp?: number;
      event_type?: string;
      data?: Record<string, unknown>;
      tags?: string[];
    }
  ): Promise<{ event: Event }> {
    return request(`/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<{ success: boolean }> {
    return request(`/events/${id}`, { method: 'DELETE' });
  },

  async listTypes(): Promise<{ types: string[] }> {
    return request('/events/types/list');
  },
};

// Schemas API
export const schemas = {
  async list(): Promise<{ schemas: EventSchema[] }> {
    return request('/schemas');
  },

  async get(id: string): Promise<{ schema: EventSchema }> {
    return request(`/schemas/${id}`);
  },

  async getByName(name: string): Promise<{ schema: EventSchema }> {
    return request(`/schemas/by-name/${name}`);
  },

  async create(data: {
    name: string;
    label: string;
    fields: FieldDefinition[];
    icon?: string;
    color?: string;
    default_tags?: string[];
  }): Promise<{ schema: EventSchema }> {
    return request('/schemas', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(
    id: string,
    data: {
      label?: string;
      fields?: FieldDefinition[];
      icon?: string;
      color?: string;
      default_tags?: string[];
    }
  ): Promise<{ schema: EventSchema }> {
    return request(`/schemas/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<{ success: boolean }> {
    return request(`/schemas/${id}`, { method: 'DELETE' });
  },
};

// Import API
export const importApi = {
  async json(eventsList: Array<{
    timestamp: string | number;
    event_type: string;
    data?: Record<string, unknown>;
    tags?: string[];
  }>): Promise<{
    imported: number;
    total: number;
    errors: string[];
  }> {
    return request('/import/json', {
      method: 'POST',
      body: JSON.stringify({ events: eventsList }),
    });
  },

  async csv(csvContent: string): Promise<{
    imported: number;
    total: number;
    errors: string[];
  }> {
    const response = await fetch(`${API_BASE}/import/csv`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: csvContent,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(data.error || 'Request failed', response.status);
    }

    return data;
  },

  async previewCsv(csvContent: string): Promise<{
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
  }> {
    const response = await fetch(`${API_BASE}/import/csv/preview`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: csvContent,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(data.error || 'Request failed', response.status);
    }

    return data;
  },
};

export { ApiError };
