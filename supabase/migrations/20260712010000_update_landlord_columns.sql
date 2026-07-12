-- Add new columns and remove zone from landlords table
ALTER TABLE landlords
  ADD COLUMN house_number VARCHAR(100),
  ADD COLUMN lane_number VARCHAR(100),
  ADD COLUMN occupation VARCHAR(100),
  ADD COLUMN notes TEXT,
  DROP COLUMN zone;

-- Indexes for new columns
CREATE INDEX idx_landlords_house_number ON landlords(house_number);
CREATE INDEX idx_landlords_lane_number ON landlords(lane_number);
CREATE INDEX idx_landlords_occupation ON landlords(occupation);