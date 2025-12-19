// Production Database Types (READ ONLY)
// These types mirror the production database schema

export interface Client {
  id: string;
  client_name: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ClientIntegration {
  id: string;
  client_id: string;
  integration_type: string;
  is_active: boolean;
  created_at: Date;
}

export interface Prospect {
  id: string;
  client_integration_id: string;
  lead_email: string;
  company_domain: string | null;
  lead_category_id: string | null;
  last_interaction_time: Date | null;
  created_at: Date;
}

export interface EmailConversation {
  id: string;
  prospect_id: string;
  client_integration_id: string;
  type: 'Sent' | 'Received';
  timestamp_email: Date;
  subject: string | null;
  body: string | null;
  created_at: Date;
}

export interface AttributionEvent {
  id: string;
  client_integration_id: string;
  client_id: string;
  event_type: string; // sign_up, meeting_booked, paying_customer, dnc, website_visit
  email: string | null;
  domain: string | null;
  event_time: Date;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface LeadCategory {
  id: string;
  name: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | null;
  created_at: Date;
}



