ALTER TABLE feedback ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false;

CREATE POLICY "Admins can update feedback"
    ON feedback FOR UPDATE
    USING (EXISTS (SELECT 1 FROM admin_profiles WHERE id = auth.uid()));
