-- Migration: Add columns for people extraction tracking
-- Supports AI-extracted hosts with verification workflow

-- Add verification status for AI-extracted hosts
ALTER TABLE source_people ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;
ALTER TABLE source_people ADD COLUMN IF NOT EXISTS ai_confidence VARCHAR(20);

-- Track extraction status on videos
ALTER TABLE videos ADD COLUMN IF NOT EXISTS people_extracted_at TIMESTAMPTZ;

-- Track host extraction status on sources/channels
ALTER TABLE sources ADD COLUMN IF NOT EXISTS hosts_extracted_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN source_people.verified IS 'Whether the AI-extracted host has been manually verified';
COMMENT ON COLUMN source_people.ai_confidence IS 'AI confidence level: high, medium, or low';
COMMENT ON COLUMN videos.people_extracted_at IS 'Timestamp when people were extracted from this video';
COMMENT ON COLUMN sources.hosts_extracted_at IS 'Timestamp when hosts were extracted for this channel';
