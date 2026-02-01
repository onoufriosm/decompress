-- Migration: Email Digest Support
-- Adds email digest preferences and logging for daily digest emails

-- =============================================================================
-- EMAIL PREFERENCES ON PROFILES
-- =============================================================================

-- Add email digest preference columns to existing profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email_digest_enabled BOOLEAN DEFAULT FALSE;

-- Track when last digest was sent to avoid duplicates
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ;

-- =============================================================================
-- DIGEST EMAIL LOGS
-- =============================================================================

-- Track sent digests for debugging and analytics
CREATE TABLE IF NOT EXISTS digest_email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Email metadata
    resend_email_id VARCHAR(255),
    recipient_email TEXT NOT NULL,

    -- Content stats
    video_count INTEGER NOT NULL DEFAULT 0,
    channel_count INTEGER NOT NULL DEFAULT 0,

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'bounced'
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_digest_email_logs_user_id ON digest_email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_digest_email_logs_created_at ON digest_email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_digest_email_logs_status ON digest_email_logs(status);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE digest_email_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own digest logs
CREATE POLICY "Users can view own digest logs"
    ON digest_email_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Service role inserts (system-initiated)
-- Note: Service role bypasses RLS by default

-- =============================================================================
-- FUNCTION: Get users eligible for digest
-- =============================================================================

CREATE OR REPLACE FUNCTION get_users_for_digest()
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
        p.last_digest_sent_at
    FROM profiles p
    WHERE p.email_digest_enabled = TRUE
    AND p.email IS NOT NULL
    AND (
        p.last_digest_sent_at IS NULL
        OR p.last_digest_sent_at < NOW() - INTERVAL '23 hours'
    )
    -- Only include users with at least one favorite channel
    AND EXISTS (
        SELECT 1 FROM user_favorite_channels ufc
        WHERE ufc.user_id = p.id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: Get digest videos for a user (from favorited channels only)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_digest_videos(
    check_user_id UUID,
    hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
    video_id UUID,
    video_title TEXT,
    video_description TEXT,
    video_thumbnail_url TEXT,
    video_duration_seconds INTEGER,
    video_published_at TIMESTAMPTZ,
    video_summary TEXT,
    video_view_count BIGINT,
    source_id UUID,
    source_name TEXT,
    source_thumbnail_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.id,
        v.title::TEXT,
        v.description::TEXT,
        v.thumbnail_url::TEXT,
        v.duration_seconds,
        v.published_at,
        v.summary::TEXT,
        v.view_count,
        s.id,
        s.name::TEXT,
        s.thumbnail_url::TEXT
    FROM videos v
    JOIN sources s ON s.id = v.source_id
    JOIN user_favorite_channels ufc ON ufc.source_id = s.id
    WHERE ufc.user_id = check_user_id
    AND v.published_at > NOW() - (hours_back || ' hours')::INTERVAL
    AND v.thumbnail_url IS NOT NULL
    ORDER BY v.published_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: Update last digest sent timestamp
-- =============================================================================

CREATE OR REPLACE FUNCTION update_last_digest_sent(check_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET last_digest_sent_at = NOW()
    WHERE id = check_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN profiles.email_digest_enabled IS 'Whether user receives daily email digests';
COMMENT ON COLUMN profiles.last_digest_sent_at IS 'When last digest email was sent to this user';
COMMENT ON TABLE digest_email_logs IS 'Log of all digest emails sent for tracking and debugging';
COMMENT ON FUNCTION get_users_for_digest() IS 'Returns users eligible for daily digest (enabled, has email, has favorites, not sent in 23h)';
COMMENT ON FUNCTION get_digest_videos(UUID, INTEGER) IS 'Returns videos from favorited channels for digest email';
