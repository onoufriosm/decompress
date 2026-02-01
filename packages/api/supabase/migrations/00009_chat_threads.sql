-- Chat threads and messages for persistent chat history

-- Chat threads table
CREATE TABLE chat_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for videos associated with a thread
CREATE TABLE chat_thread_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(thread_id, video_id)
);

-- Indexes
CREATE INDEX idx_chat_threads_user ON chat_threads(user_id);
CREATE INDEX idx_chat_threads_updated ON chat_threads(updated_at DESC);
CREATE INDEX idx_chat_messages_thread ON chat_messages(thread_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX idx_chat_thread_videos_thread ON chat_thread_videos(thread_id);

-- RLS policies
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_thread_videos ENABLE ROW LEVEL SECURITY;

-- Users can only see their own threads
CREATE POLICY "Users can view own threads"
    ON chat_threads FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own threads"
    ON chat_threads FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own threads"
    ON chat_threads FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own threads"
    ON chat_threads FOR DELETE
    USING (auth.uid() = user_id);

-- Messages policies (through thread ownership)
CREATE POLICY "Users can view messages in own threads"
    ON chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_threads
            WHERE chat_threads.id = chat_messages.thread_id
            AND chat_threads.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create messages in own threads"
    ON chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_threads
            WHERE chat_threads.id = chat_messages.thread_id
            AND chat_threads.user_id = auth.uid()
        )
    );

-- Thread videos policies
CREATE POLICY "Users can view thread videos in own threads"
    ON chat_thread_videos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_threads
            WHERE chat_threads.id = chat_thread_videos.thread_id
            AND chat_threads.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can add videos to own threads"
    ON chat_thread_videos FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_threads
            WHERE chat_threads.id = chat_thread_videos.thread_id
            AND chat_threads.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can remove videos from own threads"
    ON chat_thread_videos FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM chat_threads
            WHERE chat_threads.id = chat_thread_videos.thread_id
            AND chat_threads.user_id = auth.uid()
        )
    );

-- Function to update thread updated_at when messages are added
CREATE OR REPLACE FUNCTION update_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_threads
    SET updated_at = NOW()
    WHERE id = NEW.thread_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_thread_timestamp
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_thread_timestamp();

-- Function to auto-generate thread title from first message
CREATE OR REPLACE FUNCTION set_thread_title_from_first_message()
RETURNS TRIGGER AS $$
DECLARE
    current_title TEXT;
BEGIN
    -- Only for user messages
    IF NEW.role = 'user' THEN
        SELECT title INTO current_title
        FROM chat_threads
        WHERE id = NEW.thread_id;

        -- Only update if title is still default
        IF current_title = 'New Chat' THEN
            UPDATE chat_threads
            SET title = LEFT(NEW.content, 50) || CASE WHEN LENGTH(NEW.content) > 50 THEN '...' ELSE '' END
            WHERE id = NEW.thread_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_thread_title
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION set_thread_title_from_first_message();
