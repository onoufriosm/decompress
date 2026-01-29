-- Create digest functions that were missing from 00013

-- Function: Get users eligible for digest
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
    AND EXISTS (
        SELECT 1 FROM user_favorite_channels ufc
        WHERE ufc.user_id = p.id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get digest videos for a user (from favorited channels only)
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

-- Function: Update last digest sent timestamp
CREATE OR REPLACE FUNCTION update_last_digest_sent(check_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET last_digest_sent_at = NOW()
    WHERE id = check_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
