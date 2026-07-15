-- Add projects and pledges tables for public zone info display

-- ===========================================
-- PROJECTS TABLE
-- ===========================================
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    estimated_budget DECIMAL(12, 2) DEFAULT 0,
    milestone_level VARCHAR(50) NOT NULL DEFAULT 'open'
        CHECK (milestone_level IN ('open', 'awaiting_funding', 'in_progress', 'pending', 'canceled', 'completed')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by UUID REFERENCES admin_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_milestone ON projects(milestone_level);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all projects"
    ON projects FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert projects"
    ON projects FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update projects"
    ON projects FOR UPDATE
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can delete projects"
    ON projects FOR DELETE
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- ===========================================
-- PLEDGES TABLE
-- ===========================================
CREATE TABLE pledges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donor_name VARCHAR(255) NOT NULL,
    landlord_id UUID REFERENCES landlords(id) ON DELETE SET NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'partial', 'fulfilled')),
    created_by UUID REFERENCES admin_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pledges_status ON pledges(status);
CREATE INDEX idx_pledges_created_at ON pledges(created_at DESC);
CREATE INDEX idx_pledges_landlord ON pledges(landlord_id);

ALTER TABLE pledges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all pledges"
    ON pledges FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert pledges"
    ON pledges FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update pledges"
    ON pledges FOR UPDATE
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can delete pledges"
    ON pledges FOR DELETE
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- ===========================================
-- PUBLIC DASHBOARD DATA RPC (SECURITY DEFINER)
-- ===========================================
-- Returns a JSON structure with all data needed by the public viewer page.
-- Runs with DEFINER permissions so unauthenticated users can access
-- aggregated financial data without opening RLS on individual tables.
CREATE OR REPLACE FUNCTION get_public_dashboard_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance NUMERIC;
    v_outstanding NUMERIC;
    v_projects JSON;
    v_recent_payments JSON;
    v_pledges JSON;
    v_top_debtors JSON;
BEGIN
    -- Account balance
    SELECT COALESCE(balance, 0) INTO v_balance FROM account_balance LIMIT 1;

    -- Total outstanding (sum of all active landlord expected amounts minus confirmed payments)
    SELECT COALESCE(SUM(sub.outstanding), 0) INTO v_outstanding
    FROM (
        SELECT
            COALESCE(expected.total_expected, 0) - COALESCE(paid.total_paid, 0) AS outstanding
        FROM (
            SELECT landlord_id, SUM(amount) AS total_expected
            FROM landlord_payment_types
            WHERE active = true
            GROUP BY landlord_id
        ) expected
        LEFT JOIN (
            SELECT landlord_id, SUM(amount) AS total_paid
            FROM payments
            WHERE status = 'confirmed'
            GROUP BY landlord_id
        ) paid ON paid.landlord_id = expected.landlord_id
    ) sub
    WHERE sub.outstanding > 0;

    -- Projects
    SELECT json_agg(json_build_object(
        'id', p.id,
        'name', p.name,
        'description', p.description,
        'estimated_budget', p.estimated_budget,
        'milestone_level', p.milestone_level,
        'status', p.status,
        'created_at', p.created_at
    ) ORDER BY p.created_at DESC)
    INTO v_projects
    FROM projects p
    WHERE p.status = 'active'
    ORDER BY p.created_at DESC;

    -- Recent payments (last 10)
    SELECT json_agg(json_build_object(
        'id', p.id,
        'amount', p.amount,
        'status', p.status,
        'created_at', p.created_at,
        'landlord', json_build_object(
            'title', l.title,
            'full_name', l.full_name,
            'house_number', l.house_number,
            'lane_number', l.lane_number,
            'road', l.road
        ),
        'payment_type', json_build_object(
            'name', pt.name
        )
    ) ORDER BY p.created_at DESC)
    INTO v_recent_payments
    FROM payments p
    JOIN landlords l ON l.id = p.landlord_id
    JOIN payment_types pt ON pt.id = p.payment_type_id
    ORDER BY p.created_at DESC
    LIMIT 10;

    -- Pledges (last 10)
    SELECT json_agg(json_build_object(
        'id', pl.id,
        'donor_name', pl.donor_name,
        'amount', pl.amount,
        'description', pl.description,
        'status', pl.status,
        'created_at', pl.created_at,
        'landlord', CASE WHEN pl.landlord_id IS NOT NULL THEN
            json_build_object('title', l2.title, 'full_name', l2.full_name)
        ELSE NULL END
    ) ORDER BY pl.created_at DESC)
    INTO v_pledges
    FROM pledges pl
    LEFT JOIN landlords l2 ON l2.id = pl.landlord_id
    ORDER BY pl.created_at DESC
    LIMIT 10;

    -- Top 10 debtors
    SELECT json_agg(json_build_object(
        'id', l3.id,
        'title', l3.title,
        'full_name', l3.full_name,
        'outstanding', sub2.outstanding
    ) ORDER BY sub2.outstanding DESC)
    INTO v_top_debtors
    FROM (
        SELECT
            expected.landlord_id,
            COALESCE(expected.total_expected, 0) - COALESCE(paid.total_paid, 0) AS outstanding
        FROM (
            SELECT landlord_id, SUM(amount) AS total_expected
            FROM landlord_payment_types
            WHERE active = true
            GROUP BY landlord_id
        ) expected
        LEFT JOIN (
            SELECT landlord_id, SUM(amount) AS total_paid
            FROM payments
            WHERE status = 'confirmed'
            GROUP BY landlord_id
        ) paid ON paid.landlord_id = expected.landlord_id
        WHERE COALESCE(expected.total_expected, 0) > COALESCE(paid.total_paid, 0)
    ) sub2
    JOIN landlords l3 ON l3.id = sub2.landlord_id AND l3.status = 'active'
    ORDER BY sub2.outstanding DESC
    LIMIT 10;

    RETURN json_build_object(
        'account_balance', v_balance,
        'total_outstanding', v_outstanding,
        'projects', COALESCE(v_projects, '[]'::json),
        'recent_payments', COALESCE(v_recent_payments, '[]'::json),
        'pledges', COALESCE(v_pledges, '[]'::json),
        'top_debtors', COALESCE(v_top_debtors, '[]'::json)
    );
END;
$$;

-- Grant execute to anon (public) and authenticated users
GRANT EXECUTE ON FUNCTION get_public_dashboard_data() TO anon, authenticated;