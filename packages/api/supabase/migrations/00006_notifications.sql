-- Migration: Notifications System
-- This migration adds notifications for new videos from favorited channels

-- =============================================================================
-- USER LAST VISIT TRACKING
-- =============================================================================

-- Add last_visit_at to profiles to track when user last visited
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ DEFAULT NOW();

-- =============================================================================
-- NOTIFICATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Notification type and content
    type VARCHAR(50) NOT NULL, -- 'new_video', 'new_summary', etc.
    title TEXT NOT NULL,
    message TEXT,

    -- Related entities
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,

    -- Status
    read_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_video_id ON notifications(video_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
    ON notifications FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can insert notifications (for triggers)
-- Note: Service role bypasses RLS by default

-- =============================================================================
-- FUNCTION: Create notifications for new videos
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_favorited_channel_new_video()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert a notification for each user who has favorited this channel
    INSERT INTO notifications (user_id, type, title, message, video_id, source_id)
    SELECT
        ufc.user_id,
        'new_video',
        'New video from ' || s.name,
        NEW.title,
        NEW.id,
        NEW.source_id
    FROM user_favorite_channels ufc
    JOIN sources s ON s.id = NEW.source_id
    WHERE ufc.source_id = NEW.source_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: Create notifications for new summaries
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_favorited_channel_new_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger if summary was added (old was null, new is not null)
    IF OLD.summary IS NULL AND NEW.summary IS NOT NULL THEN
        -- Insert a notification for each user who has favorited this channel
        INSERT INTO notifications (user_id, type, title, message, video_id, source_id)
        SELECT
            ufc.user_id,
            'new_summary',
            'New summary available',
            NEW.title,
            NEW.id,
            NEW.source_id
        FROM user_favorite_channels ufc
        JOIN sources s ON s.id = NEW.source_id
        WHERE ufc.source_id = NEW.source_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger for new videos
DROP TRIGGER IF EXISTS on_new_video_notify ON videos;
CREATE TRIGGER on_new_video_notify
    AFTER INSERT ON videos
    FOR EACH ROW
    EXECUTE FUNCTION notify_favorited_channel_new_video();

-- Trigger for new summaries
DROP TRIGGER IF EXISTS on_new_summary_notify ON videos;
CREATE TRIGGER on_new_summary_notify
    AFTER UPDATE ON videos
    FOR EACH ROW
    EXECUTE FUNCTION notify_favorited_channel_new_summary();

-- =============================================================================
-- FUNCTION: Update last visit timestamp
-- =============================================================================

CREATE OR REPLACE FUNCTION update_user_last_visit(check_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE profiles
    SET last_visit_at = NOW()
    WHERE id = check_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: Get new videos since last visit for favorited channels
-- =============================================================================

CREATE OR REPLACE FUNCTION get_new_videos_since_last_visit(check_user_id UUID)
RETURNS TABLE (
    video_id UUID,
    video_title TEXT,
    video_thumbnail_url TEXT,
    video_duration_seconds INTEGER,
    video_published_at TIMESTAMPTZ,
    video_summary TEXT,
    source_id UUID,
    source_name TEXT,
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

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE notifications IS 'User notifications for new videos and summaries';
COMMENT ON COLUMN notifications.type IS 'Notification type: new_video, new_summary';
COMMENT ON COLUMN notifications.read_at IS 'When the notification was read (NULL if unread)';
COMMENT ON COLUMN profiles.last_visit_at IS 'When the user last visited the app';
