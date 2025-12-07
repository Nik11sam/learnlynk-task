# LearnLynk Technical Assessment
A complete implementation of a multi-tenant lead & task management system built with Supabase, RLS, Edge Functions, and a Next.js frontend.
This repository demonstrates real-world SaaS architecture including secure data modeling, isolated tenancy, serverless APIs, and a fully functional dashboard.

# Overview
This project is structured to match LearnLynk's assessment requirements, while also following scalable SaaS best practices:

Strong multi-tenant RBAC enforcement at the database level
Clean schema design aligned with foreign keys & indexes
Edge Function for controlled server-side operations
RLS policies ensuring counselors/admins access only allowed rows
Next.js dashboard for real-time task visualization
Stripe payment architecture description for production usage

The repository is divided into:
backend/
frontend/
supabase/ (deployment)
Each section is documented in detail below.

# Architecture
            ┌──────────────────────────┐
            │        Frontend           │
            │  Next.js (React + TS)     │
            │  /dashboard/today         │
            └──────────────┬───────────┘
                           │
                           ▼
            ┌──────────────────────────┐
            │   Supabase JS Client     │
            │   Auth + RLS enforced    │
            └──────────────┬───────────┘
                           │
┌─────────────────────────────▼───────────────────────────────┐
│                       Supabase Backend                       │
│                                                               │
│   ┌──────────────┐   ┌────────────────┐   ┌────────────────┐ │
│   │ leads table  │←──│ applications   │←──│    tasks       │ │
│   └──────────────┘   └────────────────┘   └────────────────┘ │
│                                                               │
│   Row Level Security (tenant_id, role, owner_id restrictions) │
│                                                               │
│   Edge Function: create-task (Deno + Service Role Key)        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
This architecture ensures:

Frontend always runs as a restricted user
Edge Functions run with privileged permissions
Database enforces authorization at the deepest level
Multi-tenant safety is mathematically guaranteed


# Database Schema
Located in: backend/schema.sql
Tables created:

leads
applications
tasks

# Common columns:
-- Common columns used across all tables
id uuid primary key default gen_random_uuid(),
tenant_id uuid not null,
created_at timestamptz default now(),
updated_at timestamptz default now();

-- Allowed Task Types
CHECK (type IN ('call', 'email', 'review'));

-- Task deadline constraint
CHECK (due_at >= created_at);

-- Foreign Keys
alter table applications
add constraint applications_lead_fk
foreign key (lead_id) references leads(id);

alter table tasks
add constraint tasks_application_fk
foreign key (application_id) references applications(id);

-- Indexes for high-performance querying
create index leads_tenant_idx on leads (tenant_id);
create index leads_owner_idx on leads (owner_id);
create index leads_stage_idx on leads (stage);

create index applications_tenant_idx on applications (tenant_id);
create index applications_lead_idx on applications (lead_id);

create index tasks_tenant_idx on tasks (tenant_id);
create index tasks_due_at_idx on tasks (due_at);
create index tasks_status_idx on tasks (status);


# Row Level Security (RLS)
Located in: backend/rls_policies.sql
RLS is enabled on leads table.
sqlalter table leads enable row level security;
JWT Contents
The JWT used by authenticated users contains:
json{
  "user_id": "...",
  "tenant_id": "...",
  "role": "admin" | "counselor"
}
SELECT Policy Summary
Admins

Can read all leads belonging to their tenant.

Counselors

Can read leads they personally own
Can read leads belonging to teams they are a member of

SQL logic uses:
sqlcurrent_setting('request.jwt.claims', true)::jsonb
This ensures safety at DB-level even if frontend is compromised.
INSERT Policy Summary
Counselors and admins may insert new leads only if the tenant_id matches their own tenant.