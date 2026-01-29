-- Migration: Add summary column to videos table
-- This column was supposed to be added by migration 00002 but was not applied

ALTER TABLE videos ADD COLUMN IF NOT EXISTS summary TEXT;

-- Add comment for documentation
COMMENT ON COLUMN videos.summary IS 'AI-generated summary of the video content';
