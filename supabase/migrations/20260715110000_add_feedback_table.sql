-- Table for public feedback/suggestions submitted from the zone-info page
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(30),
    category VARCHAR(30) NOT NULL DEFAULT 'suggestion'
        CHECK (category IN ('suggestion', 'bug', 'compliment', 'other')),
    message TEXT NOT NULL CHECK (char_length(message) >= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (no auth required — this is a public page)
CREATE POLICY "Anyone can insert feedback"
    ON feedback FOR INSERT
    WITH CHECK (true);

-- Only admins can view feedback
CREATE POLICY "Admins can view feedback"
    ON feedback FOR SELECT
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));
