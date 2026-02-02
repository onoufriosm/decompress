-- Migration: Use calendar days for digest instead of rolling hours
-- Daily = yesterday (midnight to midnight UTC)
-- Weekly = last 7 calendar days (midnight to midnight UTC)

-- =============================================================================
-- UPDATE GET_DIGEST_VIDEOS FUNCTION
-- =============================================================================

-- Now uses calendar days instead of rolling hours
CREATE OR REPLACE FUNCTION get_digest_videos(
    check_user_id UUID,
    frequency VARCHAR DEFAULT 'daily'
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
    start_date TIMESTAMPTZ;
    end_date TIMESTAMPTZ;
BEGIN
    -- Calculate date range based on frequency
    -- end_date is always today at midnight (start of today)
    end_date := DATE_TRUNC('day', NOW());

    IF frequency = 'weekly' THEN
        -- Weekly: 7 days ago at midnight to today at midnight
        start_date := end_date - INTERVAL '7 days';
    ELSE
        -- Daily: yesterday at midnight to today at midnight
        start_date := end_date - INTERVAL '1 day';
    END IF;

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
        AND v.published_at >= start_date
        AND v.published_at < end_date
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
        WHERE v.published_at >= start_date
        AND v.published_at < end_date
        AND v.thumbnail_url IS NOT NULL
        ORDER BY v.published_at DESC
        LIMIT 50;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON FUNCTION get_digest_videos(UUID, VARCHAR) IS 'Returns videos for digest using calendar days. Daily = yesterday, Weekly = last 7 days. Uses favorites if available, otherwise all channels.';
