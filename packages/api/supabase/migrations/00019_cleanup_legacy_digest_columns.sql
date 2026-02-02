-- Migration: Cleanup legacy digest columns
-- Remove obsolete columns that were replaced in 00017_dual_digest_support.sql
--
-- Columns being removed:
-- - email_digest_enabled (replaced by daily_digest_enabled + weekly_digest_enabled)
-- - digest_frequency (replaced by separate boolean flags)
-- - last_digest_sent_at (replaced by last_daily_digest_sent_at + last_weekly_digest_sent_at)

-- =============================================================================
-- DROP OBSOLETE COLUMNS
-- =============================================================================

ALTER TABLE profiles
DROP COLUMN IF EXISTS email_digest_enabled,
DROP COLUMN IF EXISTS digest_frequency,
DROP COLUMN IF EXISTS last_digest_sent_at;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE profiles IS 'User profile data. Digest preferences use daily_digest_enabled and weekly_digest_enabled columns.';
