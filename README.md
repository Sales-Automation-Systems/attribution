# Attribution System MVP

A comprehensive attribution tracking system that matches email outreach to CRM success events (sign-ups, meetings, paying customers) and generates billing reconciliation reports.

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Attribution Logic Deep Dive](#2-attribution-logic-deep-dive)
3. [Worker Processing Phases](#3-worker-processing-phases)
4. [Database Schema](#4-database-schema)
5. [Billing & Reconciliation Logic](#5-billing--reconciliation-logic)
6. [API Reference](#6-api-reference)
7. [Frontend Features](#7-frontend-features)
8. [Handoff Notes](#8-handoff-notes)

---

## 1. System Overview

### Purpose

The Attribution System tracks email outreach campaigns and determines which CRM success events (sign-ups, meetings booked, paying customers) can be attributed to those emails. This enables:

- **Performance tracking**: See which outreach campaigns drive results
- **Billing/reconciliation**: Generate invoices based on attributed success events
- **Client dashboards**: Share attribution data with clients

### Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4 |
| UI Components | shadcn/ui |
| Databases | PostgreSQL (2 separate databases) |
| Worker | Express.js on Railway |
| Hosting | Vercel (frontend), Railway (worker) |
| State Management | React hooks, URL state |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VERCEL (Frontend)                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                         Next.js Application                              ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   ││
│  │  │ Client       │  │ Admin        │  │ API Routes   │                   ││
│  │  │ Dashboard    │  │ Dashboard    │  │              │                   ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘                   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASES                                       │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │   Production DB (Read-Only)  │  │   Attribution DB (Read-Write)        │ │
│  │   ─────────────────────────  │  │   ──────────────────────────         │ │
│  │   • client                   │  │   • client_config                    │ │
│  │   • client_integration       │  │   • attributed_domain                │ │
│  │   • email_conversation       │  │   • domain_event                     │ │
│  │   • prospect                 │  │   • reconciliation_period            │ │
│  │   • attribution_event        │  │   • reconciliation_line_item         │ │
│  │   • lead_category            │  │   • task                             │ │
│  └──────────────────────────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RAILWAY (Background Worker)                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                      Express.js Worker Service                           ││
│  │  • Processes attribution jobs                                            ││
│  │  • Batch operations for performance                                      ││
│  │  • Real-time job logging                                                 ││
│  │  • Endpoints: /process-client, /process-all, /sync-clients               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   CRM       │────▶│  Production │────▶│   Worker    │────▶│ Attribution │
│   Events    │     │     DB      │     │  (Railway)  │     │     DB      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
                                                                   ▼
                    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
                    │   Client    │◀────│   Next.js   │◀────│   API       │
                    │  Dashboard  │     │   Frontend  │     │   Routes    │
                    └─────────────┘     └─────────────┘     └─────────────┘
```

---

## 2. Attribution Logic Deep Dive

### 2.1 Core Matching Algorithm

The attribution engine determines whether a success event (sign-up, meeting, paying customer) can be attributed to email outreach. Here's the complete algorithm:

```
FOR each success event (sign_up, meeting_booked, paying_customer):

  1. EXTRACT email and domain from the event record
     - Normalize domain (lowercase, strip www, handle multi-part TLDs like co.uk)
     
  2. TRY HARD MATCH (exact email match):
     - Search for: "Did we send an email to this exact person?"
     - Find the most recent email sent to this email address BEFORE the event occurred
     - If found → HARD_MATCH (highest confidence)
     
  3. IF no hard match AND soft_match_enabled:
     TRY SOFT MATCH (domain match):
     - Search for: "Did we email anyone at this company?"
     - Find the most recent email sent to this domain BEFORE the event occurred
     - If found → SOFT_MATCH (company-level attribution)
     
  4. IF no match found → NO_MATCH (unattributed)
     - Event still recorded but not billable
     - Can be manually attributed later by client
     
  5. CALCULATE attribution window:
     - days_since_email = event_date - email_sent_date
     
  6. IF days_since_email <= attribution_window_days (default: 31):
     - Status = ATTRIBUTED (within window, billable)
     
  7. ELSE:
     - Status = OUTSIDE_WINDOW (matched but event occurred too late, not billable)
```

### 2.2 Attribution Decision Tree

```
                              ┌─────────────────┐
                              │  Success Event  │
                              │  (from CRM)     │
                              └────────┬────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │  Did we email this exact     │
                        │  person BEFORE the event?    │
                        └──────────────┬───────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │ YES                                 │ NO
                    ▼                                     ▼
            ┌───────────────┐               ┌──────────────────────────────┐
            │  HARD_MATCH   │               │  Is soft matching enabled?   │
            └───────┬───────┘               └──────────────┬───────────────┘
                    │                                      │
                    │                       ┌──────────────┴──────────────┐
                    │                       │ YES                         │ NO
                    │                       ▼                             ▼
                    │         ┌──────────────────────────────┐    ┌─────────────┐
                    │         │  Did we email anyone at this │    │  NO_MATCH   │
                    │         │  domain BEFORE the event?    │    │(unattributed)│
                    │         └──────────────┬───────────────┘    └─────────────┘
                    │                        │
                    │         ┌──────────────┴──────────────┐
                    │         │ YES                         │ NO
                    │         ▼                             ▼
                    │   ┌───────────────┐           ┌─────────────┐
                    │   │  SOFT_MATCH   │           │  NO_MATCH   │
                    │   └───────┬───────┘           │(unattributed)│
                    │           │                   └─────────────┘
                    └─────┬─────┘
                          │
                          ▼
            ┌──────────────────────────────┐
            │  Days since email sent       │
            │  <= attribution_window (31)? │
            └──────────────┬───────────────┘
                           │
            ┌──────────────┴──────────────┐
            │ YES                         │ NO
            ▼                             ▼
    ┌───────────────┐             ┌───────────────┐
    │  ATTRIBUTED   │             │ OUTSIDE_WINDOW│
    │  (billable)   │             │ (not billable)│
    └───────────────┘             └───────────────┘
```

### 2.3 Domain Status State Machine

Domains transition through various statuses based on system processing and user actions:

```
                                    ┌─────────────────┐
                                    │  Initial State  │
                                    └────────┬────────┘
                                             │
                 ┌───────────────────────────┼───────────────────────────┐
                 │                           │                           │
                 ▼                           ▼                           ▼
        ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
        │   ATTRIBUTED    │        │ OUTSIDE_WINDOW  │        │  UNATTRIBUTED   │
        │ (matched,       │        │ (matched,       │        │ (no email       │
        │  within window) │        │  >31 days)      │        │  match found)   │
        └────────┬────────┘        └────────┬────────┘        └────────┬────────┘
                 │                          │                          │
                 │                          │                          │
    ┌────────────┼────────────┐             │                          │
    │ Client     │            │             │                          │
    │ disputes   │            │             ▼                          ▼
    ▼            │            │    ┌─────────────────┐        ┌─────────────────┐
┌──────────────┐ │            │    │ CLIENT_PROMOTED │◀───────│ CLIENT_PROMOTED │
│DISPUTE_PENDING│ │            │    │ (manually       │        │ (manually       │
│(in review)   │ │            │    │  attributed)    │        │  attributed)    │
└──────┬───────┘ │            │    └─────────────────┘        └─────────────────┘
       │         │            │
  ┌────┴────┐    │            │
  │         │    │            │
  ▼         ▼    │            │
┌─────┐  ┌──────────┐         │
│DISPUTED│ │ATTRIBUTED│◀────────┘
│(approved,│ │(rejected, │
│not billable)│ │stays billable)│
└─────┘  └──────────┘
```

**Status Definitions:**

| Status | Description | Billable? |
|--------|-------------|-----------|
| `ATTRIBUTED` | Matched within attribution window | Yes |
| `OUTSIDE_WINDOW` | Matched but event > 31 days after email | No |
| `UNATTRIBUTED` | No email match found | No |
| `CLIENT_PROMOTED` | Manually attributed by client | Yes |
| `DISPUTE_PENDING` | Client submitted dispute, awaiting review | Pending |
| `DISPUTED` | Dispute approved by agency | No |
| `MANUAL` | Added manually by admin | Yes |

### 2.4 Positive Replies: Special Case

Positive replies (when a prospect responds positively to an email) are handled differently:

- **Always 100% attributed** - No window check needed
- **Always HARD_MATCH** - We emailed this exact person and they replied
- **Counts toward stats** even without other success events
- **Included in timeline** with reply content for context

```
Positive Reply Logic:
─────────────────────
IF prospect replied to our email AND reply sentiment = POSITIVE:
  → Match Type = HARD_MATCH
  → Status = ATTRIBUTED
  → Is Within Window = TRUE (always)
```

### 2.5 Per-Event vs Per-Domain Counting

The system supports two counting modes, configurable per event type:

**Per-Event Mode (`per_event`)**
- Counts every individual event
- If a domain has 3 sign-ups, count = 3
- Use case: Billing per event

**Per-Domain Mode (`per_domain`)**
- Counts only the first event per domain
- If a domain has 3 sign-ups, count = 1
- Use case: Prevent duplicate billing for the same account

Configuration in `client_config`:
```sql
sign_ups_mode    = 'per_event' | 'per_domain'
meetings_mode    = 'per_event' | 'per_domain'
paying_mode      = 'per_event' | 'per_domain'  -- usually 'per_domain'
```

### 2.6 Focus View: Hard Match Only

The "Focus View" feature shows only hard-matched events and the specific contacts (emails) that were matched:

- Filters timeline to show events from matched contacts only
- Dims unrelated events (soft matches, other contacts)
- `matched_emails` array stores all hard-matched email addresses per domain
- Useful for verifying attribution accuracy

---

## 3. Worker Processing Phases

The background worker (`worker/server.ts`) processes attribution in 8 distinct phases:

### Phase Overview

| Phase | Name | Description | Performance Notes |
|-------|------|-------------|-------------------|
| 0 | Clear Events | Delete non-manual events for fresh processing | Quick |
| 1 | Stats | Count total emails sent | Single query |
| 2 | Events | Fetch all attribution_event records | Single query |
| 3 | Replies | Fetch positive replies from prospect table | Single query |
| 4a | Email Lookup | Build email → send_time map | Chunked (500/batch) |
| 4b | Domain Lookup | Build domain → send_time map | Chunked (500/batch) |
| 5 | Process Events | Match each event, calculate window, assign status | In-memory |
| 6 | Process Replies | Mark all replies as HARD_MATCH attributed | In-memory |
| 6.5 | Email History | Fetch all emails for timeline display | Chunked (200/batch) |
| 7 | Save | Batch upsert domains and events to attribution DB | Chunked (500/1000) |
| 8 | Update Stats | Write aggregated counts to client_config | Single query |

### Detailed Phase Descriptions

#### Phase 0: Clear Events
```typescript
// Delete all non-manual events for this client
// This ensures fresh processing without duplicates
// Manual events (source_table = 'manual_entry') are preserved
DELETE FROM domain_event 
WHERE attributed_domain_id IN (
  SELECT id FROM attributed_domain WHERE client_config_id = $1
)
AND source_table != 'manual_entry'
```

#### Phase 1: Stats
```typescript
// Count total emails sent by this client
SELECT COUNT(*) as count
FROM email_conversation ec
JOIN client_integration ci ON ec.client_integration_id = ci.id
WHERE ec.type = 'Sent' AND ci.client_id = $1
```

#### Phase 2: Events
```typescript
// Fetch all success events (sign-ups, meetings, paying customers)
SELECT ae.id, ae.event_type, ae.email, ae.domain, ae.event_time
FROM attribution_event ae
JOIN client_integration ci ON ae.client_integration_id = ci.id
WHERE ci.client_id = $1
  AND ae.event_type IN ('sign_up', 'meeting_booked', 'paying_customer')
ORDER BY ae.event_time
```

#### Phase 3: Replies
```typescript
// Fetch all positive replies
SELECT p.id, p.lead_email, p.first_name, p.last_name,
       p.company_domain, p.last_interaction_time,
       lc.name as category_name
FROM prospect p
JOIN lead_category lc ON p.lead_category_id = lc.id
JOIN client_integration ci ON p.client_integration_id = ci.id
WHERE lc.sentiment = 'POSITIVE'
  AND ci.client_id = $1
```

#### Phase 4a: Email Lookup (Chunked)
```typescript
// For each chunk of 500 emails:
// Get ALL send timestamps (not just MIN) for accurate window calculation
SELECT LOWER(p.lead_email) as email, ec.timestamp_email as sent_at
FROM email_conversation ec
JOIN prospect p ON ec.prospect_id = p.id
JOIN client_integration ci ON ec.client_integration_id = ci.id
WHERE ec.type = 'Sent'
  AND ci.client_id = $1
  AND LOWER(p.lead_email) = ANY($2)  -- batch of emails
ORDER BY ec.timestamp_email
```

#### Phase 4b: Domain Lookup (Chunked)
```typescript
// For each chunk of 500 domains:
// Get ALL send timestamps for each domain
SELECT LOWER(p.company_domain) as domain, ec.timestamp_email as sent_at
FROM email_conversation ec
JOIN prospect p ON ec.prospect_id = p.id
JOIN client_integration ci ON ec.client_integration_id = ci.id
WHERE ec.type = 'Sent'
  AND ci.client_id = $1
  AND LOWER(p.company_domain) = ANY($2)  -- batch of domains
ORDER BY ec.timestamp_email
```

#### Phase 5: Process Events
```typescript
// For each event:
// 1. Find most recent email sent BEFORE the event
// 2. Determine match type (HARD/SOFT/NO_MATCH)
// 3. Calculate days since email
// 4. Determine if within attribution window
// 5. Aggregate by domain
```

Key helper function:
```typescript
const findMostRecentDomainEmailBefore = (domain: string, eventTime: Date): Date | null => {
  const timestamps = domainAllSendTimes.get(domain);
  if (!timestamps || timestamps.length === 0) return null;
  
  // Find the most recent timestamp that's BEFORE the event
  let mostRecent: Date | null = null;
  for (const ts of timestamps) {
    if (ts <= eventTime) {
      if (!mostRecent || ts > mostRecent) {
        mostRecent = ts;
      }
    }
  }
  return mostRecent;
};
```

#### Phase 6: Process Replies
```typescript
// Positive replies are always:
// - HARD_MATCH (we emailed this exact person)
// - ATTRIBUTED (100% attribution, no window check)
// - Added to matchedEmails array for Focus View
```

#### Phase 6.5: Email History
```typescript
// For each domain (chunked, 200 at a time):
// Fetch all emails sent to build timeline
SELECT ec.id, ec.timestamp_email, p.lead_email, p.first_name, p.last_name,
       ec.subject, ec.body, LOWER(p.company_domain) as company_domain
FROM email_conversation ec
JOIN prospect p ON ec.prospect_id = p.id
JOIN client_integration ci ON ec.client_integration_id = ci.id
WHERE ec.type = 'Sent'
  AND ci.client_id = $1
  AND LOWER(p.company_domain) = ANY($2)
ORDER BY ec.timestamp_email
```

#### Phase 7: Save (Batch Optimized)
```typescript
// Phase 7a: Batch upsert domains (500 at a time)
INSERT INTO attributed_domain (
  client_config_id, domain, first_email_sent_at, first_event_at, ...
)
VALUES (...), (...), ...  -- multi-value insert
ON CONFLICT (client_config_id, domain) DO UPDATE SET ...
RETURNING id, domain

// Phase 7b: Batch insert events (1000 at a time)
INSERT INTO domain_event (
  attributed_domain_id, event_source, event_time, email, source_id, ...
)
VALUES (...), (...), ...  -- multi-value insert
ON CONFLICT (attributed_domain_id, event_source, source_id) DO NOTHING
```

#### Phase 8: Update Stats
```typescript
// Write all aggregated counts to client_config
UPDATE client_config SET
  total_emails_sent = $2,
  total_positive_replies = $3,
  total_sign_ups = $4,
  total_meetings_booked = $5,
  total_paying_customers = $6,
  attributed_positive_replies = $7,
  attributed_sign_ups = $8,
  attributed_meetings_booked = $9,
  attributed_paying_customers = $10,
  // ... (30+ stat columns)
  last_processed_at = NOW()
WHERE id = $1
```

### Worker Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/jobs` | GET | List all jobs (last 50) |
| `/job/:jobId` | GET | Get job status |
| `/job/:jobId/logs` | GET | Get job logs |
| `/sync-clients` | POST | Sync clients from production DB |
| `/process-client` | POST | Process single client `{ clientId }` |
| `/process-all` | POST | Process all clients |
| `/cancel-job/:jobId` | POST | Cancel running job |
| `/audit-domain` | POST | Debug domain data `{ clientId, domain }` |

---

## 4. Database Schema

### Production Database (Read-Only)

The production database contains the source data from the main application.

#### `client`
```sql
CREATE TABLE client (
  id UUID PRIMARY KEY,
  client_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `client_integration`
```sql
CREATE TABLE client_integration (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES client(id),
  integration_type VARCHAR(50),  -- 'hubspot', 'salesforce', etc.
  is_active BOOLEAN DEFAULT true
);
```

#### `email_conversation`
```sql
CREATE TABLE email_conversation (
  id UUID PRIMARY KEY,
  client_integration_id UUID REFERENCES client_integration(id),
  prospect_id UUID REFERENCES prospect(id),
  type VARCHAR(20),  -- 'Sent' or 'Received'
  subject TEXT,
  body TEXT,
  timestamp_email TIMESTAMP
);
```

#### `prospect`
```sql
CREATE TABLE prospect (
  id UUID PRIMARY KEY,
  client_integration_id UUID REFERENCES client_integration(id),
  lead_email VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  company_domain VARCHAR(255),
  lead_category_id UUID REFERENCES lead_category(id),
  last_interaction_time TIMESTAMP
);
```

#### `attribution_event`
```sql
CREATE TABLE attribution_event (
  id UUID PRIMARY KEY,
  client_integration_id UUID REFERENCES client_integration(id),
  event_type VARCHAR(50),  -- 'sign_up', 'meeting_booked', 'paying_customer'
  email VARCHAR(255),
  domain VARCHAR(255),
  event_time TIMESTAMP
);
```

#### `lead_category`
```sql
CREATE TABLE lead_category (
  id UUID PRIMARY KEY,
  name VARCHAR(100),
  sentiment VARCHAR(20)  -- 'POSITIVE', 'NEGATIVE', 'NEUTRAL'
);
```

### Attribution Database (Read-Write)

The attribution database stores processed attribution data and configuration.

#### `client_config`
```sql
CREATE TABLE client_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,                    -- References production client.id
  client_name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,                 -- URL-friendly name
  access_uuid UUID DEFAULT gen_random_uuid(), -- Client dashboard access token
  
  -- Attribution Settings
  attribution_window_days INTEGER DEFAULT 31,
  soft_match_enabled BOOLEAN DEFAULT true,
  exclude_personal_domains BOOLEAN DEFAULT true,
  
  -- Counting Modes
  sign_ups_mode VARCHAR(20) DEFAULT 'per_event',
  meetings_mode VARCHAR(20) DEFAULT 'per_event',
  paying_mode VARCHAR(20) DEFAULT 'per_domain',
  
  -- Billing Configuration
  billing_model VARCHAR(50) DEFAULT 'flat_revshare',
  rev_share_rate DECIMAL(5,4) DEFAULT 0.10,
  plg_rate DECIMAL(5,4),
  sales_assisted_rate DECIMAL(5,4),
  sign_up_fee DECIMAL(10,2),
  meeting_fee DECIMAL(10,2),
  billing_cadence VARCHAR(20) DEFAULT 'quarterly',
  
  -- Stats (updated by worker)
  total_emails_sent INTEGER DEFAULT 0,
  total_positive_replies INTEGER DEFAULT 0,
  total_sign_ups INTEGER DEFAULT 0,
  total_meetings_booked INTEGER DEFAULT 0,
  total_paying_customers INTEGER DEFAULT 0,
  attributed_positive_replies INTEGER DEFAULT 0,
  attributed_sign_ups INTEGER DEFAULT 0,
  attributed_meetings_booked INTEGER DEFAULT 0,
  attributed_paying_customers INTEGER DEFAULT 0,
  -- ... (many more stat columns)
  
  last_processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(client_id),
  UNIQUE(slug, access_uuid)
);
```

#### `attributed_domain`
```sql
CREATE TABLE attributed_domain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_config_id UUID REFERENCES client_config(id),
  domain VARCHAR(255) NOT NULL,
  
  -- Timing
  first_email_sent_at TIMESTAMP,
  first_event_at TIMESTAMP,
  last_event_at TIMESTAMP,
  
  -- Attribution
  is_within_window BOOLEAN DEFAULT false,
  match_type VARCHAR(20),  -- 'HARD_MATCH', 'SOFT_MATCH', 'NO_MATCH'
  matched_email VARCHAR(255),      -- Legacy: first matched email
  matched_emails TEXT[],           -- All hard-matched contacts
  status VARCHAR(30) DEFAULT 'ATTRIBUTED',
  
  -- Event Flags
  has_sign_up BOOLEAN DEFAULT false,
  has_meeting_booked BOOLEAN DEFAULT false,
  has_paying_customer BOOLEAN DEFAULT false,
  has_positive_reply BOOLEAN DEFAULT false,
  
  -- Manual Attribution
  promoted_at TIMESTAMP,
  promoted_by VARCHAR(255),
  promotion_notes TEXT,
  
  -- Dispute
  dispute_reason TEXT,
  dispute_submitted_at TIMESTAMP,
  dispute_resolved_at TIMESTAMP,
  dispute_resolution_notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(client_config_id, domain)
);
```

#### `domain_event`
```sql
CREATE TABLE domain_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attributed_domain_id UUID REFERENCES attributed_domain(id),
  event_source VARCHAR(50),  -- 'EMAIL_SENT', 'SIGN_UP', 'MEETING_BOOKED', 
                             -- 'PAYING_CUSTOMER', 'POSITIVE_REPLY', 'STATUS_CHANGE'
  event_time TIMESTAMP,
  email VARCHAR(255),        -- Contact email (if applicable)
  source_id VARCHAR(255),    -- ID from source system
  source_table VARCHAR(100), -- 'email_conversation', 'attribution_event', etc.
  metadata JSONB,            -- Additional event data
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(attributed_domain_id, event_source, source_id)
);
```

#### `reconciliation_period`
```sql
CREATE TABLE reconciliation_period (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_config_id UUID REFERENCES client_config(id),
  period_type VARCHAR(20),   -- 'quarterly', 'monthly'
  year INTEGER NOT NULL,
  quarter INTEGER,           -- 1-4 for quarterly
  month INTEGER,             -- 1-12 for monthly
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'OPEN',  -- 'OPEN', 'CLOSED', 'OVERDUE'
  estimated_total DECIMAL(12,2) DEFAULT 0,
  final_total DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(client_config_id, period_type, year, quarter),
  UNIQUE(client_config_id, period_type, year, month)
);
```

#### `reconciliation_line_item`
```sql
CREATE TABLE reconciliation_line_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_period_id UUID REFERENCES reconciliation_period(id),
  attributed_domain_id UUID REFERENCES attributed_domain(id),
  domain VARCHAR(255) NOT NULL,
  line_item_type VARCHAR(50),  -- 'paying_customer', 'sign_up', 'meeting'
  description TEXT,
  acv DECIMAL(12,2),           -- Annual Contract Value
  rate DECIMAL(5,4),           -- Rev share rate applied
  amount DECIMAL(12,2),        -- Calculated amount
  paying_customer_date DATE,   -- When customer became paying
  status VARCHAR(20) DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(reconciliation_period_id, attributed_domain_id)
);
```

#### `task`
```sql
CREATE TABLE task (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_config_id UUID REFERENCES client_config(id),
  attributed_domain_id UUID REFERENCES attributed_domain(id),
  task_type VARCHAR(50),       -- 'dispute', 'review', 'manual_add'
  title VARCHAR(255),
  description TEXT,
  status VARCHAR(20) DEFAULT 'OPEN',  -- 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'
  priority VARCHAR(20) DEFAULT 'MEDIUM',
  assigned_to VARCHAR(255),
  submitted_by VARCHAR(255),
  resolution VARCHAR(20),      -- 'APPROVED', 'REJECTED'
  resolution_notes TEXT,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 5. Billing & Reconciliation Logic

### 5.1 Billing Models

The system supports four billing models configured in `client_config.billing_model`:

#### Flat Rev Share (`flat_revshare`)
```
Amount = ACV × rev_share_rate
```
- Simple percentage of Annual Contract Value
- Default rate: 10% (`rev_share_rate = 0.10`)
- Applied to all paying customers

#### PLG/Sales Split (`plg_sales_split`)
```
If customer_type = 'PLG':
  Amount = ACV × plg_rate
Else (Sales-Assisted):
  Amount = ACV × sales_assisted_rate
```
- Different rates for product-led vs sales-led deals
- Determined by `is_plg` flag on line item
- Common: 10% PLG, 5% sales-assisted

#### Per-Event (`per_event`)
```
Sign-up Amount = count × sign_up_fee
Meeting Amount = count × meeting_fee
```
- Fixed fee per event type
- No ACV or rev share involved
- Common for early-stage clients

#### Hybrid
```
Paying Customer Amount = ACV × rev_share_rate
+ Sign-up Amount = count × sign_up_fee
+ Meeting Amount = count × meeting_fee
```
- Combination of rev share and per-event fees
- Most flexible model

### 5.2 The 12-Month Billing Window

Paying customers are billed across ALL periods within 12 months of becoming a paying customer:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Example: Customer becomes paying on July 15, 2025                          │
│                                                                             │
│  Q3 2025 (Jul-Sep)  ✓ Within 12 months                                     │
│  Q4 2025 (Oct-Dec)  ✓ Within 12 months                                     │
│  Q1 2026 (Jan-Mar)  ✓ Within 12 months                                     │
│  Q2 2026 (Apr-Jun)  ✓ Within 12 months (ends Jul 14)                       │
│  Q3 2026 (Jul-Sep)  ✗ Outside 12-month window                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Implementation in `reconciliation/sync/route.ts`:**

```typescript
// Check if domain's paying_customer_date falls within 12 months of period
const payingDate = new Date(domain.paying_customer_date);
const twelveMonthsAfterPaying = new Date(payingDate);
twelveMonthsAfterPaying.setMonth(twelveMonthsAfterPaying.getMonth() + 12);

const periodStart = new Date(period.start_date);
const periodEnd = new Date(period.end_date);

// Domain appears in period if:
// 1. Paying date is before period end, AND
// 2. 12-month window extends into the period
const isWithinBillingWindow = 
  payingDate <= periodEnd && 
  twelveMonthsAfterPaying >= periodStart;
```

**Cleanup Logic:**

```typescript
// cleanupStaleLineItems() removes line items that:
// 1. Are outside the 12-month billing window
// 2. No longer meet the criteria for inclusion

// cleanupDisputedLineItems() removes line items for:
// 1. Domains with status = 'DISPUTED' (approved disputes)
```

### 5.3 Dispute Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DISPUTE FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. CLIENT SUBMITS DISPUTE                                                  │
│     ─────────────────────                                                   │
│     • Domain status → DISPUTE_PENDING                                       │
│     • Task created with type = 'dispute'                                    │
│     • Reason captured in dispute_reason                                     │
│     • Logged as STATUS_CHANGE event                                         │
│                                                                             │
│  2. AGENCY REVIEWS                                                          │
│     ───────────────                                                         │
│     • Task visible in admin dashboard                                       │
│     • Can view domain timeline and history                                  │
│     • Decision: APPROVE or REJECT                                           │
│                                                                             │
│  3a. IF APPROVED                                                            │
│      ────────────                                                           │
│      • Domain status → DISPUTED                                             │
│      • Line items removed from reconciliation                               │
│      • Not billed to client                                                 │
│      • Logged as STATUS_CHANGE event                                        │
│                                                                             │
│  3b. IF REJECTED                                                            │
│      ────────────                                                           │
│      • Domain status → ATTRIBUTED (restored)                                │
│      • Remains billable                                                     │
│      • Client can re-dispute with new evidence                              │
│      • Logged as STATUS_CHANGE event                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 Reconciliation Sync Process

The reconciliation sync (`/api/reconciliation/sync`) performs:

1. **Upsert periods**: Create/update quarterly periods for client
2. **Cleanup stale items**: Remove line items outside 12-month window
3. **Cleanup disputed items**: Remove line items for disputed domains
4. **Populate line items**: Add billable domains based on billing model
5. **Backfill dates**: Fill in missing `paying_customer_date` values
6. **Update totals**: Calculate `estimated_total` for each period

---

## 6. API Reference

### Client Stats API

**Endpoint:** `GET /api/clients/[slug]/[uuid]/stats`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | string | Filter events from this date (YYYY-MM-DD) |
| `endDate` | string | Filter events until this date (YYYY-MM-DD) |

**Response:**
```json
{
  "stats": {
    "totalEmailsSent": 50000,
    "attributedPositiveReplies": 150,
    "attributedSignUps": 89,
    "attributedMeetings": 45,
    "attributedPaying": 12,
    "outsideWindowSignUps": 23,
    "outsideWindowMeetings": 8,
    "outsideWindowPaying": 2,
    "notMatchedSignUps": 15,
    "notMatchedMeetings": 5,
    "notMatchedPaying": 1
  },
  "accountStats": {
    "attributedAccountsWithSignUps": 67,
    "attributedAccountsWithMeetings": 38,
    "attributedAccountsWithPaying": 12,
    "outsideWindowAccountsWithSignUps": 18,
    "outsideWindowAccountsWithMeetings": 6,
    "outsideWindowAccountsWithPaying": 2,
    "unattributedAccountsWithSignUps": 12,
    "unattributedAccountsWithMeetings": 4,
    "unattributedAccountsWithPaying": 1
  },
  "dateRange": {
    "startDate": "2025-01-01T00:00:00.000Z",
    "endDate": "2025-03-31T23:59:59.999Z"
  }
}
```

### Domains API

**Endpoint:** `GET /api/clients/[slug]/[uuid]/domains`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `attributed`, `outside_window`, `not_attributed`, `dispute_pending` |
| `events` | string | Filter by event type: `reply`, `signup`, `meeting`, `paying` |
| `search` | string | Search domain name |
| `focusView` | boolean | Show only hard matches |
| `limit` | number | Max results (default 100) |
| `offset` | number | Pagination offset |

**Response:**
```json
{
  "domains": [
    {
      "id": "uuid",
      "domain": "example.com",
      "status": "ATTRIBUTED",
      "matchType": "HARD_MATCH",
      "isWithinWindow": true,
      "firstEmailSentAt": "2025-01-15T10:00:00Z",
      "firstEventAt": "2025-02-01T14:30:00Z",
      "hasSignUp": true,
      "hasMeetingBooked": true,
      "hasPayingCustomer": false,
      "hasPositiveReply": true,
      "matchedEmails": ["john@example.com", "jane@example.com"]
    }
  ],
  "total": 150,
  "hasMore": true
}
```

### Timeline API

**Endpoint:** `GET /api/clients/[slug]/[uuid]/domains/[domainId]/timeline`

**Response:**
```json
{
  "timeline": [
    {
      "id": "event-uuid",
      "type": "EMAIL_SENT",
      "date": "2025-01-15T10:00:00Z",
      "email": "john@example.com",
      "metadata": {
        "subject": "Introduction",
        "recipientName": "John Doe"
      }
    },
    {
      "id": "event-uuid-2",
      "type": "SIGN_UP",
      "date": "2025-02-01T14:30:00Z",
      "email": "john@example.com",
      "metadata": {
        "matched": true,
        "matchType": "HARD_MATCH"
      }
    },
    {
      "id": "synthetic-attribution-uuid",
      "type": "STATUS_CHANGE",
      "date": "2025-02-01T14:30:00Z",
      "metadata": {
        "action": "SYSTEM_UPDATE",
        "oldStatus": null,
        "newStatus": "ATTRIBUTED",
        "reason": "Attribution determined by system",
        "changedBy": "System",
        "synthetic": true
      }
    }
  ],
  "domain": {
    "name": "example.com",
    "matchType": "HARD_MATCH",
    "matchedEmails": ["john@example.com"],
    "isWithinWindow": true,
    "status": "ATTRIBUTED"
  }
}
```

### Submit Dispute

**Endpoint:** `POST /api/clients/[slug]/[uuid]/domains/[domainId]/dispute`

**Request Body:**
```json
{
  "reason": "not_our_lead",
  "details": "This lead came through a different channel",
  "submittedBy": "client@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Dispute submitted successfully",
  "taskId": "task-uuid"
}
```

### Add Event (Manual)

**Endpoint:** `POST /api/clients/[slug]/[uuid]/domains/[domainId]/events`

**Request Body:**
```json
{
  "eventType": "EMAIL_SENT",
  "eventTime": "2025-01-10T09:00:00Z",
  "email": "contact@example.com",
  "notes": "Manual entry - email log recovered"
}
```

**Response:**
```json
{
  "success": true,
  "eventId": "event-uuid",
  "statusUpdated": true,
  "newStatus": "ATTRIBUTED"
}
```

### Manual Attribution

**Endpoint:** `POST /api/clients/[slug]/[uuid]/domains/[domainId]/attribute`

**Request Body:**
```json
{
  "attributedBy": "admin@agency.com",
  "notes": "Client confirmed this was from our outreach"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Domain attributed successfully",
  "newStatus": "CLIENT_PROMOTED"
}
```

### Add to Reconciliation

**Endpoint:** `POST /api/clients/[slug]/[uuid]/reconciliation/add-domain`

**Request Body:**
```json
{
  "domainId": "domain-uuid",
  "billingStartDate": "2025-07-15"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Domain added to reconciliation",
  "periodsAffected": 4,
  "lineItemsCreated": 4
}
```

### Reconciliation Sync

**Endpoint:** `POST /api/reconciliation/sync`

**Request Body:**
```json
{
  "clientId": "client-config-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "periodsCreated": 2,
  "lineItemsCreated": 15,
  "lineItemsRemoved": 3
}
```

### Resolve Dispute (Admin)

**Endpoint:** `POST /api/admin/tasks/[taskId]/resolve`

**Request Body:**
```json
{
  "resolution": "APPROVED",
  "notes": "Confirmed lead came from different source",
  "resolvedBy": "admin@agency.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Dispute resolved",
  "domainStatus": "DISPUTED"
}
```

---

## 7. Frontend Features

### 7.1 Events vs Accounts Toggle

The dashboard displays attribution data at two levels:

**Events View** (count individual events)
- Total sign-ups: 89
- Total meetings: 45
- Multiple events per domain counted separately

**Accounts View** (count unique domains)
- Accounts with sign-ups: 67
- Accounts with meetings: 38
- One count per domain regardless of event count

Toggle location: Top of Client Dashboard, affects both Pipeline and Attribution Breakdown sections.

### 7.2 Date Range Filtering

Filter all stats by event date:
- **This Month**: Current calendar month
- **Last Month**: Previous calendar month
- **This Quarter**: Current calendar quarter
- **Custom Range**: Date picker for custom dates

Note: "Emails Sent" always shows total (cannot filter by date due to data source limitations).

### 7.3 Focus View

Shows only hard-matched (high-confidence) attributions:
- Toggle: "Focus" switch in filters
- Effect: Hides soft-match and no-match domains
- In timeline: Dims events from non-matched contacts

### 7.4 Dispute Mode

Password-protected feature for beta testing:
- **Access**: Click "Dispute" filter → Enter password "Dispute"
- **When enabled**: Shows "Dispute" button on each domain
- **Purpose**: Hidden from beta clients, visible to developers

### 7.5 Timeline Dialog

Click any domain to view detailed timeline:
- All events in chronological order
- Email content with subject/body
- Event type badges (Sign-Up, Meeting, Paying Customer)
- Status change history

**Event Type Filtering:**
- Click event badges to filter timeline
- Multiple badges can be active
- Dims non-matching events (doesn't hide)

### 7.6 Status Change Audit Trail

All status changes are logged and visible in timeline:
- Dispute submitted
- Dispute approved/rejected
- Manual attribution
- System attribution updates

### 7.7 Sticky Headers

When scrolling long timelines:
- Focus View header stays visible
- Event filter message stays visible
- Helps maintain context while scrolling

---

## 8. Handoff Notes

### 8.1 Known Limitations

| Limitation | Description | Workaround |
|------------|-------------|------------|
| No Authentication | User IDs are placeholders | TODO markers in code |
| Emails Sent Filter | Cannot filter by date | Always shows total |
| Account Stats | Don't support date filtering | Shows all-time counts |
| Reply Content | May be truncated | Full content in metadata |

### 8.2 Environment Variables

**Required for Next.js app (Vercel):**
```env
ATTR_DATABASE_URL=postgresql://user:pass@host:5432/attribution
PROD_DATABASE_URL=postgresql://user:pass@host:5432/production
```

**Required for Worker (Railway):**
```env
ATTR_DATABASE_URL=postgresql://user:pass@host:5432/attribution
PROD_DATABASE_URL=postgresql://user:pass@host:5432/production
PORT=3001
```

### 8.3 Debug Logs Retained

The following debug logs are intentionally kept for troubleshooting:

- `[DEBUG:timeline-api]` - Timeline endpoint debugging
- `[DEBUG:domains-api]` - Domains query debugging
- Worker job logs - Stored in `job_log` table

### 8.4 TODO Items for Production

Search the codebase for "TODO" to find:

1. **Authentication Integration** (4 places)
   - `dispute/route.ts` - `submittedBy` should come from auth
   - `attribute/route.ts` - `attributedBy` should come from auth
   - `events/route.ts` - `addedBy` should come from auth
   - `task-queries.ts` - `resolvedBy` should come from auth

2. **Dispute Password**
   - Currently hardcoded as "Dispute"
   - Should be environment variable for production

3. **Rate Limiting**
   - No rate limiting on API endpoints
   - Add for production deployment

### 8.5 Key Files Reference

| File | Purpose |
|------|---------|
| `worker/server.ts` | Background processing worker |
| `src/db/attribution/queries.ts` | Core database queries |
| `src/db/attribution/task-queries.ts` | Dispute/task queries |
| `src/app/api/reconciliation/sync/route.ts` | Reconciliation sync logic |
| `src/components/attribution/client-stats-section.tsx` | Dashboard stats UI |
| `src/components/attribution/accounts-table.tsx` | Domain list table |
| `src/components/attribution/timeline-dialog.tsx` | Domain timeline modal |
| `src/components/attribution/account-timeline.tsx` | Timeline event display |

### 8.6 Database Migrations

Migrations are in `sql/migrations/` and run via:
```bash
POST /api/admin/run-migration
{ "migration": "001_initial_schema.sql" }
```

Key migrations:
- `001` - Initial schema
- `010` - Reconciliation tables
- `015` - Fix disputed status
- `024` - Create missing events
- `026` - Fix missing paying events

---

## Quick Start for Developers

1. **Clone and install:**
   ```bash
   git clone <repo>
   cd attribution
   npm install
   ```
   
2. **Set environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit with your database URLs
   ```
   
3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Run worker locally:**
   ```bash
   cd worker
   npm install
   npm run dev
   ```

5. **Process a client:**
   ```bash
   curl -X POST http://localhost:3001/process-client \
     -H "Content-Type: application/json" \
     -d '{"clientId": "your-client-uuid"}'
   ```

---

*Last updated: December 2025*
