-- Migration: User Favorite Channels
-- This migration adds the ability for authenticated users to star/favorite channels

-- =============================================================================
-- USER FAVORITE CHANNELS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_favorite_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Each user can only favorite a channel once
    CONSTRAINT user_favorite_channels_unique UNIQUE(user_id, source_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_favorite_channels_user_id ON user_favorite_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorite_channels_source_id ON user_favorite_channels(source_id);
CREATE INDEX IF NOT EXISTS idx_user_favorite_channels_created_at ON user_favorite_channels(created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE user_favorite_channels ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites
CREATE POLICY "Users can view own favorites"
    ON user_favorite_channels FOR SELECT
    USING (auth.uid() = user_id);

-- Users can add favorites
CREATE POLICY "Users can add favorites"
    ON user_favorite_channels FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can remove their own favorites
CREATE POLICY "Users can remove own favorites"
    ON user_favorite_channels FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE user_favorite_channels IS 'Stores user favorite/starred channels';
COMMENT ON COLUMN user_favorite_channels.user_id IS 'The user who favorited the channel';
COMMENT ON COLUMN user_favorite_channels.source_id IS 'The channel (source) that was favorited';
