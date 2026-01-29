-- Migration: Fuzzy Search Functions
-- This migration adds RPC functions for fuzzy text search using pg_trgm

-- =============================================================================
-- FUZZY SEARCH FUNCTIONS
-- =============================================================================

-- Set similarity threshold (0.0 to 1.0, lower = more fuzzy matches)
-- Default PostgreSQL threshold is 0.3
SELECT set_limit(0.2);

-- Function to search videos with fuzzy matching
CREATE OR REPLACE FUNCTION search_videos_fuzzy(
    search_term TEXT,
    result_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    external_id TEXT,
    title TEXT,
    description TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    published_at TIMESTAMPTZ,
    view_count BIGINT,
    source_id UUID,
    source_name TEXT,
    similarity_score REAL
) AS $$
BEGIN
    IF search_term IS NULL OR search_term = '' THEN
        -- No search term, return recent videos
        RETURN QUERY
        SELECT
            v.id,
            v.external_id,
            v.title,
            v.description,
            v.thumbnail_url,
            v.duration_seconds,
            v.published_at,
            v.view_count,
            s.id AS source_id,
            s.name AS source_name,
            1.0::REAL AS similarity_score
        FROM videos v
        LEFT JOIN sources s ON v.source_id = s.id
        ORDER BY v.published_at DESC NULLS LAST
        LIMIT result_limit;
    ELSE
        -- Fuzzy search using pg_trgm
        RETURN QUERY
        SELECT
            v.id,
            v.external_id,
            v.title,
            v.description,
            v.thumbnail_url,
            v.duration_seconds,
            v.published_at,
            v.view_count,
            s.id AS source_id,
            s.name AS source_name,
            GREATEST(
                COALESCE(similarity(v.title, search_term), 0),
                COALESCE(similarity(v.description, search_term), 0) * 0.8
            ) AS similarity_score
        FROM videos v
        LEFT JOIN sources s ON v.source_id = s.id
        WHERE
            v.title % search_term
            OR v.description % search_term
            OR v.title ILIKE '%' || search_term || '%'
            OR v.description ILIKE '%' || search_term || '%'
        ORDER BY similarity_score DESC, v.published_at DESC NULLS LAST
        LIMIT result_limit;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to search channels/sources with fuzzy matching
CREATE OR REPLACE FUNCTION search_sources_fuzzy(
    search_term TEXT,
    source_type_filter TEXT DEFAULT 'youtube_channel',
    result_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    external_id TEXT,
    name TEXT,
    handle TEXT,
    description TEXT,
    thumbnail_url TEXT,
    subscriber_count BIGINT,
    video_count INTEGER,
    last_scraped_at TIMESTAMPTZ,
    similarity_score REAL
) AS $$
BEGIN
    IF search_term IS NULL OR search_term = '' THEN
        -- No search term, return all sources of the specified type
        RETURN QUERY
        SELECT
            s.id,
            s.external_id,
            s.name,
            s.handle,
            s.description,
            s.thumbnail_url,
            s.subscriber_count,
            s.video_count,
            s.last_scraped_at,
            1.0::REAL AS similarity_score
        FROM sources s
        WHERE s.source_type = source_type_filter
        ORDER BY s.name
        LIMIT result_limit;
    ELSE
        -- Fuzzy search using pg_trgm
        RETURN QUERY
        SELECT
            s.id,
            s.external_id,
            s.name,
            s.handle,
            s.description,
            s.thumbnail_url,
            s.subscriber_count,
            s.video_count,
            s.last_scraped_at,
            GREATEST(
                COALESCE(similarity(s.name, search_term), 0),
                COALESCE(similarity(s.handle, search_term), 0) * 0.9,
                COALESCE(similarity(s.description, search_term), 0) * 0.7
            ) AS similarity_score
        FROM sources s
        WHERE
            s.source_type = source_type_filter
            AND (
                s.name % search_term
                OR s.handle % search_term
                OR s.description % search_term
                OR s.name ILIKE '%' || search_term || '%'
                OR s.handle ILIKE '%' || search_term || '%'
                OR s.description ILIKE '%' || search_term || '%'
            )
        ORDER BY similarity_score DESC, s.name
        LIMIT result_limit;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions to authenticated and anon users
GRANT EXECUTE ON FUNCTION search_videos_fuzzy TO authenticated, anon;
GRANT EXECUTE ON FUNCTION search_sources_fuzzy TO authenticated, anon;
