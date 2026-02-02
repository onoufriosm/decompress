-- Migration: Add user timezone support
-- Stores user's timezone for future personalized digest scheduling

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';

COMMENT ON COLUMN profiles.timezone IS 'User timezone in IANA format (e.g., America/New_York, Europe/London)';
