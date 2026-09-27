-- Add archive support for landlord deactivation/activation
-- When a landlord is deactivated, deactivated_at and deactivated_by are set
-- (this is the "archive" — all FK-linked data stays in place)
-- When reactivated, these fields are cleared, restoring full access.

ALTER TABLE landlords
  ADD COLUMN deactivated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN deactivated_by UUID REFERENCES admin_profiles(id);

CREATE INDEX idx_landlords_deactivated_at ON landlords(deactivated_at);