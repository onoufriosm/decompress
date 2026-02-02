-- Migration: Digest Enhancements
-- 1. Add digest_frequency preference (daily/weekly)
-- 2. Update get_users_for_digest() to support frequency and remove favorites requirement
-- 3. Update get_digest_videos() to fall back to all channels if no favorites

-- =============================================================================
-- ADD DIGEST FREQUENCY COLUMN
-- =============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS digest_frequency VARCHAR(20) DEFAULT 'daily';
-- Values: 'daily', 'weekly'

-- =============================================================================
-- UPDATE GET_USERS_FOR_DIGEST FUNCTION
-- =============================================================================

-- Now accepts frequency parameter and removes favorites requirement
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
        p.last_digest_sent_at
    FROM profiles p
    WHERE p.email_digest_enabled = TRUE
    AND p.email IS NOT NULL
    AND p.digest_frequency = target_frequency
    AND (
        CASE
            WHEN target_frequency = 'daily' THEN
                p.last_digest_sent_at IS NULL
                OR p.last_digest_sent_at < NOW() - INTERVAL '23 hours'
            WHEN target_frequency = 'weekly' THEN
                p.last_digest_sent_at IS NULL
                OR p.last_digest_sent_at < NOW() - INTERVAL '6 days 23 hours'
            ELSE
                FALSE
        END
    )
    -- Only include users with valid access (subscribed OR trial active)
    AND public.has_valid_access(p.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- UPDATE GET_DIGEST_VIDEOS FUNCTION
-- =============================================================================

-- Now falls back to all channels if user has no favorites
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
DECLARE
    has_favorites BOOLEAN;
BEGIN
    -- Check if user has any favorites
    SELECT EXISTS (
        SELECT 1 FROM user_favorite_channels ufc
        WHERE ufc.user_id = check_user_id
    ) INTO has_favorites;

    IF has_favorites THEN
        -- Return videos from favorited channels only
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
    ELSE
        -- Fallback: return videos from ALL channels
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
        WHERE v.published_at > NOW() - (hours_back || ' hours')::INTERVAL
        AND v.thumbnail_url IS NOT NULL
        ORDER BY v.published_at DESC
        LIMIT 50;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN profiles.digest_frequency IS 'How often user receives email digests: daily or weekly';
COMMENT ON FUNCTION get_users_for_digest(VARCHAR) IS 'Returns users eligible for digest by frequency (daily/weekly). No longer requires favorites.';
COMMENT ON FUNCTION get_digest_videos(UUID, INTEGER) IS 'Returns videos for digest. Uses favorites if available, otherwise all channels.';
