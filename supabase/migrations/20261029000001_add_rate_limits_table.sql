-- Migration: Add rate_limits table for edge function throttling
-- Date: 2026-10-29
-- Applied via supabase_apply_migration already; kept locally for versioning.
-- Creates the rate_limits table used by public-landlord-lookup and submit-feedback
-- edge functions for IP-based per-endpoint rate limiting.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key        text NOT NULL,
  endpoint   text NOT NULL,
  count      int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_endpoint ON rate_limits (key, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits (window_start);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE rate_limits IS 'Rate limiting store for edge function endpoints. Cleaned on each request.';
