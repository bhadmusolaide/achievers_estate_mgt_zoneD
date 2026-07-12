-- Migration: Add Development Levy Payment Type
-- Date: 2026-07-12
-- Purpose: Add the 5th payment type - development levy (yearly)

INSERT INTO payment_types (name, description, frequency) VALUES
    ('development_levy', 'Development Levy', 'yearly');