-- Migration: Enable Realtime for notifications table
-- This allows clients to subscribe to real-time notification updates

-- Enable replica identity for realtime to track row changes
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Add the notifications table to the supabase_realtime publication
-- This is required for Supabase Realtime to work
DO $$
BEGIN
    -- Check if publication exists and add table to it
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        -- Check if table is already in publication
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
            AND schemaname = 'public'
            AND tablename = 'notifications'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
        END IF;
    END IF;
END $$;

-- Comment for documentation
COMMENT ON TABLE notifications IS 'User notifications for new videos and summaries. Realtime enabled for instant updates.';
