-- Migration: Add Road Labeling System for Landlords
-- Date: 2026-01-22
-- Purpose: Add road column to group landlords by road for easier organization

-- Add road column to landlords table
ALTER TABLE landlords 
ADD COLUMN IF NOT EXISTS road VARCHAR(50);

-- Create index for road filtering
CREATE INDEX IF NOT EXISTS idx_landlords_road ON landlords(road);

-- Add comment for documentation
COMMENT ON COLUMN landlords.road IS 'Road identifier for grouping landlords (e.g., Road 1, Road 3)';