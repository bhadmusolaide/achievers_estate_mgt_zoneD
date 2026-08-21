-- Widen days_to_event check constraint from 3 to 7 days
-- This allows the fallback computation and edge function to support
-- celebrations up to 7 days in the future

ALTER TABLE celebrations_queue
  DROP CONSTRAINT IF EXISTS celebrations_queue_days_to_event_check,
  ADD CONSTRAINT celebrations_queue_days_to_event_check
    CHECK (days_to_event >= 0 AND days_to_event <= 7);