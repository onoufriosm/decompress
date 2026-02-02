-- Migration: Dual Digest Support
-- Allows users to receive BOTH daily AND weekly digests independently
-- 1. Add separate boolean columns for daily/weekly preferences
-- 2. Add separate last_sent timestamps for each frequency
-- 3. Update RPC functions to use new schema

-- =============================================================================
-- ADD NEW COLUMNS
-- =============================================================================

-- Separate enable flags for each frequency
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS daily_digest_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS weekly_digest_enabled BOOLEAN DEFAULT FALSE;

-- Separate last_sent timestamps for each frequency
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_daily_digest_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_weekly_digest_sent_at TIMESTAMPTZ;

-- =============================================================================
-- MIGRATE EXISTING DATA
-- =============================================================================

-- Users with email_digest_enabled = true get their preference migrated
UPDATE profiles
SET daily_digest_enabled = TRUE,
    last_daily_digest_sent_at = last_digest_sent_at
WHERE email_digest_enabled = TRUE
AND (digest_frequency = 'daily' OR digest_frequency IS NULL);

UPDATE profiles
SET weekly_digest_enabled = TRUE,
    last_weekly_digest_sent_at = last_digest_sent_at
WHERE email_digest_enabled = TRUE
AND digest_frequency = 'weekly';

-- =============================================================================
-- UPDATE GET_USERS_FOR_DIGEST FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION get_users_for_digest(target_frequency VARCHAR DEFAULT 'daily')
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    last_digest_sent_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.email,
        CASE
            WHEN target_frequency = 'weekly' THEN p.last_weekly_digest_sent_at
            ELSE p.last_daily_digest_sent_at
        END AS last_digest_sent_at
    FROM profiles p
    WHERE p.email IS NOT NULL
    AND (
        CASE
            WHEN target_frequency = 'daily' THEN p.daily_digest_enabled = TRUE
            WHEN target_frequency = 'weekly' THEN p.weekly_digest_enabled = TRUE
            ELSE FALSE
        END
    )
    AND (
        CASE
            WHEN target_frequency = 'daily' THEN
                p.last_daily_digest_sent_at IS NULL
                OR p.last_daily_digest_sent_at < NOW() - INTERVAL '23 hours'
            WHEN target_frequency = 'weekly' THEN
                p.last_weekly_digest_sent_at IS NULL
                OR p.last_weekly_digest_sent_at < NOW() - INTERVAL '6 days 23 hours'
            ELSE
                FALSE
        END
    )
    -- Only include users with valid access (subscribed OR trial active)
    AND public.has_valid_access(p.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- UPDATE UPDATE_LAST_DIGEST_SENT FUNCTION
-- =============================================================================

-- Now accepts frequency parameter to update the correct timestamp
CREATE OR REPLACE FUNCTION update_last_digest_sent(
    check_user_id UUID,
    frequency VARCHAR DEFAULT 'daily'
)
RETURNS VOID AS $$
BEGIN
    IF frequency = 'weekly' THEN
        UPDATE profiles
        SET last_weekly_digest_sent_at = NOW()
        WHERE id = check_user_id;
    ELSE
        UPDATE profiles
        SET last_daily_digest_sent_at = NOW()
        WHERE id = check_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN profiles.daily_digest_enabled IS 'Whether user receives daily email digests';
COMMENT ON COLUMN profiles.weekly_digest_enabled IS 'Whether user receives weekly email digests';
COMMENT ON COLUMN profiles.last_daily_digest_sent_at IS 'Timestamp of last daily digest sent to this user';
COMMENT ON COLUMN profiles.last_weekly_digest_sent_at IS 'Timestamp of last weekly digest sent to this user';
COMMENT ON FUNCTION get_users_for_digest(VARCHAR) IS 'Returns users eligible for digest by frequency. Users can have both daily and weekly enabled.';
COMMENT ON FUNCTION update_last_digest_sent(UUID, VARCHAR) IS 'Updates the last_sent timestamp for the specified frequency (daily/weekly).';
