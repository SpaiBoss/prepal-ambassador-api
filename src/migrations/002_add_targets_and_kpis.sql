-- Add general target setting
INSERT INTO settings (key, value) VALUES
    ('general_target_referrals', '0'),
    ('general_target_points', '0')
ON CONFLICT (key) DO NOTHING;

-- Add KPI columns to ambassadors table
ALTER TABLE ambassadors
ADD COLUMN IF NOT EXISTS target_referrals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS kpi_notes TEXT;

