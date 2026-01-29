-- Migration: Fix type mismatch in get_new_videos_since_last_visit function
-- The function declared TEXT types but actual columns use VARCHAR
-- Error 42804: "structure of query does not match function result type"
--
-- videos.title is VARCHAR(500), not TEXT
-- sources.name is VARCHAR(255), not TEXT
--
-- Must DROP first because PostgreSQL doesn't allow changing return types
-- with CREATE OR REPLACE

DROP FUNCTION IF EXISTS get_new_videos_since_last_visit(UUID);

CREATE FUNCTION get_new_videos_since_last_visit(check_user_id UUID)
RETURNS TABLE (
    video_id UUID,
    video_title VARCHAR(500),
    video_thumbnail_url TEXT,
    video_duration_seconds INTEGER,
    video_published_at TIMESTAMPTZ,
    video_summary TEXT,
    source_id UUID,
    source_name VARCHAR(255),
    source_thumbnail_url TEXT
) AS $$
DECLARE
    last_visit TIMESTAMPTZ;
BEGIN
    -- Get user's last visit time
    SELECT last_visit_at INTO last_visit
    FROM profiles
    WHERE id = check_user_id;

    -- Default to 7 days ago if no last visit
    IF last_visit IS NULL THEN
        last_visit := NOW() - INTERVAL '7 days';
    END IF;

    RETURN QUERY
    SELECT
        v.id,
        v.title,
        v.thumbnail_url,
        v.duration_seconds,
        v.published_at,
        v.summary,
        s.id,
        s.name,
        s.thumbnail_url
    FROM videos v
    JOIN sources s ON s.id = v.source_id
    JOIN user_favorite_channels ufc ON ufc.source_id = s.id
    WHERE ufc.user_id = check_user_id
    AND v.created_at > last_visit
    ORDER BY v.published_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
