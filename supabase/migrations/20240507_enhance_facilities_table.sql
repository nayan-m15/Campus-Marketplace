-- Migration: Enhance facilities table for comprehensive facility management
-- This migration adds new fields to support full facility CRUD operations
-- while maintaining backward compatibility with existing functionality

-- First, let's add the new columns to the facilities table
ALTER TABLE facilities 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS session_duration_minutes INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_facilities_status ON facilities(status);
CREATE INDEX IF NOT EXISTS idx_facilities_location ON facilities(location);
CREATE INDEX IF NOT EXISTS idx_facilities_created_at ON facilities(created_at);

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_facilities_updated_at 
    BEFORE UPDATE ON facilities 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments to document the new fields
COMMENT ON COLUMN facilities.description IS 'Detailed description of the facility and its purpose';
COMMENT ON COLUMN facilities.location IS 'Physical location or building address of the facility';
COMMENT ON COLUMN facilities.image_url IS 'URL to facility image or photo';
COMMENT ON COLUMN facilities.session_duration_minutes IS 'Default duration for each booking session in minutes';
COMMENT ON COLUMN facilities.status IS 'Current operational status of the facility (active/inactive)';
COMMENT ON COLUMN facilities.created_at IS 'Timestamp when the facility record was created';
COMMENT ON COLUMN facilities.updated_at IS 'Timestamp when the facility record was last updated';

-- Ensure existing facilities have reasonable default values
UPDATE facilities 
SET 
    description = COALESCE(description, name || ' facility'),
    session_duration_minutes = COALESCE(session_duration_minutes, 60),
    status = COALESCE(status, 'active'),
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW())
WHERE description IS NULL OR session_duration_minutes IS NULL OR status IS NULL OR created_at IS NULL OR updated_at IS NULL;

-- Add a unique constraint on facility names to prevent duplicates
ALTER TABLE facilities ADD CONSTRAINT facilities_name_unique UNIQUE (name);

-- Create a view for facility management that includes all related data
CREATE OR REPLACE VIEW facility_management_view AS
SELECT 
    f.id,
    f.name,
    f.description,
    f.location,
    f.image_url,
    f.capacity,
    f.session_duration_minutes,
    f.status,
    f.created_at,
    f.updated_at,
    COALESCE(
        json_agg(
            json_build_object(
                'day', fh.day,
                'open', fh.open,
                'start_time', fh.start_time,
                'end_time', fh.end_time
            ) ORDER BY fh.day
        ) FILTER (WHERE fh.day IS NOT NULL), 
        '[]'::json
    ) as operating_hours
FROM facilities f
LEFT JOIN facility_hours fh ON f.id = fh.facility_id
GROUP BY f.id, f.name, f.description, f.location, f.image_url, f.capacity, f.session_duration_minutes, f.status, f.created_at, f.updated_at
ORDER BY f.created_at DESC;

-- Grant necessary permissions (adjust based on your auth setup)
-- GRANT ALL ON facilities TO authenticated;
-- GRANT ALL ON facility_hours TO authenticated;
-- GRANT SELECT ON facility_management_view TO authenticated;
