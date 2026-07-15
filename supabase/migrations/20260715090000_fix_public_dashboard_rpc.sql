-- Fix get_public_dashboard_data RPC with simpler scalar subqueries
-- Drop and recreate with more robust approach

DROP FUNCTION IF EXISTS get_public_dashboard_data();

CREATE OR REPLACE FUNCTION get_public_dashboard_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    result jsonb;
BEGIN
    result := jsonb_build_object(
        'account_balance', COALESCE(
            (SELECT balance FROM account_balance LIMIT 1),
            0
        ),
        'total_outstanding', COALESCE(
            (
                SELECT SUM(
                    COALESCE(expected.total_expected, 0) - COALESCE(paid.total_paid, 0)
                )
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
            ),
            0
        ),
        'projects', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', p.id,
                        'name', p.name,
                        'description', p.description,
                        'estimated_budget', p.estimated_budget,
                        'milestone_level', p.milestone_level,
                        'status', p.status,
                        'created_at', p.created_at
                    )
                    ORDER BY p.created_at DESC
                )
                FROM projects p
                WHERE p.status = 'active'
            ),
            '[]'::jsonb
        ),
        'recent_payments', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', p.id,
                        'amount', p.amount,
                        'status', p.status,
                        'created_at', p.created_at,
                        'landlord', jsonb_build_object(
                            'title', l.title,
                            'full_name', l.full_name,
                            'house_number', l.house_number,
                            'lane_number', l.lane_number,
                            'road', l.road
                        ),
                        'payment_type', jsonb_build_object(
                            'name', pt.name
                        )
                    )
                    ORDER BY p.created_at DESC
                )
                FROM (
                    SELECT id, amount, status, created_at, landlord_id, payment_type_id
                    FROM payments
                    ORDER BY created_at DESC
                    LIMIT 10
                ) p
                LEFT JOIN landlords l ON l.id = p.landlord_id
                LEFT JOIN payment_types pt ON pt.id = p.payment_type_id
            ),
            '[]'::jsonb
        ),
        'pledges', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', pl.id,
                        'donor_name', pl.donor_name,
                        'amount', pl.amount,
                        'description', pl.description,
                        'status', pl.status,
                        'created_at', pl.created_at,
                        'landlord', CASE
                            WHEN pl.landlord_id IS NOT NULL THEN
                                jsonb_build_object(
                                    'title', l2.title,
                                    'full_name', l2.full_name
                                )
                            ELSE NULL
                        END
                    )
                    ORDER BY pl.created_at DESC
                )
                FROM (
                    SELECT id, donor_name, amount, description, status, created_at, landlord_id
                    FROM pledges
                    ORDER BY created_at DESC
                    LIMIT 10
                ) pl
                LEFT JOIN landlords l2 ON l2.id = pl.landlord_id
            ),
            '[]'::jsonb
        ),
        'top_debtors', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', l3.id,
                        'title', l3.title,
                        'full_name', l3.full_name,
                        'outstanding', sub.outstanding
                    )
                    ORDER BY sub.outstanding DESC
                )
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
                ) sub
                JOIN landlords l3 ON l3.id = sub.landlord_id AND l3.status = 'active'
                LIMIT 10
            ),
            '[]'::jsonb
        )
    );

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_dashboard_data() TO anon, authenticated;