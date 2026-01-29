-- Migration: Add summary_generated_at column to videos table
-- Tracks when AI summaries were generated

ALTER TABLE videos ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN videos.summary_generated_at IS 'Timestamp when the AI summary was generated';
