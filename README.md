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
sqlid uuid primary key default gen_random_uuid(),
tenant_id uuid not null,
created_at timestamptz default now(),
updated_at timestamptz default now()
Application Relationships
sqlapplications.lead_id → leads.id (FK)
tasks.application_id → applications.id (FK)
Allowed Task Types
sqlcall | email | review
Constraint: due_at must be in the future
sqlcheck (due_at >= created_at)
Indexing strategy (high performance)
TableIndexesPurposeleadstenant_id, owner_id, stagemulti-tenant filteringapplicationstenant_id, lead_idfast joinstaskstenant_id, due_at, statusdashboard queries

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