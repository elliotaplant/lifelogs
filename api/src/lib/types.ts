export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  RESEND_API_KEY?: string;
  APP_URL?: string;
}

export interface User {
  id: string;
  email: string;
  email_verified: number;
  created_at: number;
  updated_at?: number;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: number;
  created_at: number;
}

export interface EventSchema {
  id: string;
  user_id: string;
  name: string;
  label: string;
  fields: string; // JSON string of FieldDefinition[]
  icon?: string;
  color?: string;
  default_tags?: string; // JSON array
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

export interface Event {
  id: string;
  user_id: string;
  timestamp: number;
  event_type: string;
  data?: string; // JSON object
  tags?: string; // JSON array
  source: string;
  created_at: number;
}

export interface VerificationToken {
  id: string;
  user_id: string;
  token: string;
  type: 'email_verification' | 'password_reset';
  expires_at: number;
  created_at: number;
}

// Extended Hono context with user
export type Variables = {
  user?: User;
  session?: Session;
};
