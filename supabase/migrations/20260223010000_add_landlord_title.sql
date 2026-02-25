-- Migration: Add title field to landlords table
-- Date: 2026-02-23
-- Description: Adds a title field (Mr, Mrs, Alhaji, Chief, Pastor, etc.) for landlords
--              This is important for African context where titles are commonly used

-- Add title column to landlords table
ALTER TABLE landlords
ADD COLUMN IF NOT EXISTS title VARCHAR(20);

-- Add comment explaining the field
COMMENT ON COLUMN landlords.title IS 'Honorific title (Mr, Mrs, Alhaji, Chief, Pastor, Dr, etc.)';

