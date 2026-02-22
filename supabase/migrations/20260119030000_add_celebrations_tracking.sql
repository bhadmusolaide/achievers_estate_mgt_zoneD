-- Migration: Add Birthday & Anniversary Tracking for Landlords
-- Date: 2026-01-19

-- Add celebration fields to landlords table
ALTER TABLE landlords 
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS wedding_anniversary DATE,
ADD COLUMN IF NOT EXISTS celebrate_opt_in BOOLEAN DEFAULT FALSE;

-- Create index for celebrate_opt_in
CREATE INDEX IF NOT EXISTS idx_landlords_celebrate_opt_in 
ON landlords(celebrate_opt_in) WHERE celebrate_opt_in = TRUE;

-- Create celebrations_queue table
CREATE TABLE IF NOT EXISTS celebrations_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
    celebration_type VARCHAR(20) NOT NULL CHECK (celebration_type IN ('birthday', 'anniversary')),
    celebration_date DATE NOT NULL,
    days_to_event INTEGER NOT NULL CHECK (days_to_event >= 0 AND days_to_event <= 3),
    year INTEGER NOT NULL CHECK (year >= 2020),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sent', 'skipped')),
    custom_message TEXT,
    approved_by UUID REFERENCES admin_profiles(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    sent_via VARCHAR(20) CHECK (sent_via IN ('whatsapp', 'email') OR sent_via IS NULL),
    skipped_at TIMESTAMP WITH TIME ZONE,
    skipped_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_celebration_per_year UNIQUE (landlord_id, celebration_type, celebration_date, year)
);

-- Create indexes for celebrations_queue
CREATE INDEX IF NOT EXISTS idx_celebrations_type ON celebrations_queue(celebration_type);
CREATE INDEX IF NOT EXISTS idx_celebrations_date ON celebrations_queue(celebration_date);
CREATE INDEX IF NOT EXISTS idx_celebrations_status ON celebrations_queue(status);
CREATE INDEX IF NOT EXISTS idx_celebrations_landlord ON celebrations_queue(landlord_id);
CREATE INDEX IF NOT EXISTS idx_celebrations_days_to_event ON celebrations_queue(days_to_event);

-- Create celebration_templates table
CREATE TABLE IF NOT EXISTS celebration_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    celebration_type VARCHAR(20) NOT NULL CHECK (celebration_type IN ('birthday', 'anniversary')),
    template_name VARCHAR(100) NOT NULL,
    message_template TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed default templates (only if not exists)
INSERT INTO celebration_templates (celebration_type, template_name, message_template, is_default)
SELECT 'birthday', 'Default Birthday', 'Dear {landlord_name},

Wishing you a very Happy Birthday! 🎂🎉

On behalf of {estate_name}, we celebrate you today and wish you many more years of good health, prosperity, and happiness.

May this special day bring you joy and wonderful memories.

Warm regards,
{chairman_name}
Zone-D Estate Management', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM celebration_templates WHERE celebration_type = 'birthday' AND is_default = TRUE
);

INSERT INTO celebration_templates (celebration_type, template_name, message_template, is_default)
SELECT 'anniversary', 'Default Anniversary', 'Dear {landlord_name},

Happy Wedding Anniversary! 💍❤️

On behalf of {estate_name}, we celebrate the beautiful journey of love and partnership you share with your spouse.

May your union continue to be blessed with love, understanding, and many more wonderful years together.

Warm regards,
{chairman_name}
Zone-D Estate Management', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM celebration_templates WHERE celebration_type = 'anniversary' AND is_default = TRUE
);

-- Enable RLS on new tables
ALTER TABLE celebrations_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE celebration_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for celebrations_queue
CREATE POLICY "Admins can view all celebrations"
    ON celebrations_queue FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can insert celebrations"
    ON celebrations_queue FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update celebrations"
    ON celebrations_queue FOR UPDATE
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

-- RLS Policies for celebration_templates
CREATE POLICY "Admins can view all templates"
    ON celebration_templates FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage templates"
    ON celebration_templates FOR ALL
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));

