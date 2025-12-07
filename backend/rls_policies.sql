-- Helper tables for RLS policies
-- These  existing in  auth schema or public schema

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'counselor', 'viewer')),
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_teams (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, team_id)
);

-- Enabling RLS on leads table
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- SELECT policy for leads
-- Counselors can see leads they own OR leads assigned to teams they belong to
-- Admins can see all leads in their tenant
CREATE POLICY leads_select_policy ON leads
    FOR SELECT
    USING (
        -- Check if user is in the same tenant
        tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
        AND (
            -- Admins can see all leads in their tenant
            (auth.jwt() ->> 'role') = 'admin'
            OR
            -- Counselors can see leads they own
            (
                (auth.jwt() ->> 'role') = 'counselor'
                AND owner_id = (auth.jwt() ->> 'user_id')::UUID
            )
            OR
            -- Counselors can see leads assigned to teams they belong to
            (
                (auth.jwt() ->> 'role') = 'counselor'
                AND team_id IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM user_teams ut
                    WHERE ut.user_id = (auth.jwt() ->> 'user_id')::UUID
                    AND ut.team_id = leads.team_id
                )
            )
        )
    );

-- INSERT policy for leads
-- Only admins and counselors can insert leads
-- tenant_id must match the user's tenant
CREATE POLICY leads_insert_policy ON leads
    FOR INSERT
    WITH CHECK (
        (auth.jwt() ->> 'role') IN ('admin', 'counselor')
        AND tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
    );

-- UPDATE policy for leads
-- Same rules as SELECT
CREATE POLICY leads_update_policy ON leads
    FOR UPDATE
    USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
        AND (
            (auth.jwt() ->> 'role') = 'admin'
            OR
            (
                (auth.jwt() ->> 'role') = 'counselor'
                AND owner_id = (auth.jwt() ->> 'user_id')::UUID
            )
            OR
            (
                (auth.jwt() ->> 'role') = 'counselor'
                AND team_id IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM user_teams ut
                    WHERE ut.user_id = (auth.jwt() ->> 'user_id')::UUID
                    AND ut.team_id = leads.team_id
                )
            )
        )
    );

-- DELETE policy for leads
-- Only admins can delete leads
CREATE POLICY leads_delete_policy ON leads
    FOR DELETE
    USING (
        tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
        AND (auth.jwt() ->> 'role') = 'admin'
    );

-- Enable RLS on applications and tasks (basic policies)
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Applications policies (tenant-scoped)
CREATE POLICY applications_select_policy ON applications
    FOR SELECT
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY applications_all_policy ON applications
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

-- Tasks policies (tenant-scoped)
CREATE POLICY tasks_select_policy ON tasks
    FOR SELECT
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY tasks_all_policy ON tasks
    FOR ALL
    USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);