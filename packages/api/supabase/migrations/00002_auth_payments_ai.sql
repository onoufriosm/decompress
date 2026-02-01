-- Migration: Auth, Payments, and AI Features
-- This migration adds:
-- 1. User profiles (linked to Supabase Auth)
-- 2. Subscriptions (Stripe integration)
-- 3. Token usage tracking
-- 4. AI conversations and messages
-- 5. Video summaries
-- 6. Fuzzy search support

-- =============================================================================
-- ENABLE EXTENSIONS
-- =============================================================================

-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- USER PROFILES
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- SUBSCRIPTIONS (Stripe)
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    status TEXT NOT NULL DEFAULT 'inactive', -- active, canceled, past_due, trialing, inactive
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- =============================================================================
-- TOKEN USAGE TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS token_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    model TEXT NOT NULL,
    cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0, -- Cost in USD for this request
    request_type TEXT NOT NULL, -- 'chat', 'summary', etc.
    video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
    conversation_id UUID, -- Will reference ai_conversations
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at);

-- View for monthly token usage per user
CREATE OR REPLACE VIEW user_monthly_usage AS
SELECT
    user_id,
    DATE_TRUNC('month', created_at) AS month,
    SUM(input_tokens) AS total_input_tokens,
    SUM(output_tokens) AS total_output_tokens,
    SUM(cost_usd) AS total_cost_usd
FROM token_usage
GROUP BY user_id, DATE_TRUNC('month', created_at);

-- =============================================================================
-- AI CONVERSATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);

-- Junction table for videos in a conversation
CREATE TABLE IF NOT EXISTS conversation_videos (
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (conversation_id, video_id)
);

-- AI Messages
CREATE TABLE IF NOT EXISTS ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    token_usage_id UUID REFERENCES token_usage(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);

-- Add foreign key from token_usage to ai_conversations (now that it exists)
ALTER TABLE token_usage
    ADD CONSTRAINT fk_token_usage_conversation
    FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE SET NULL;

-- =============================================================================
-- VIDEO SUMMARIES
-- =============================================================================

-- Add summary column to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ;

-- =============================================================================
-- FUZZY SEARCH INDEXES
-- =============================================================================

-- GIN indexes for fuzzy text search on videos
CREATE INDEX IF NOT EXISTS idx_videos_title_trgm ON videos USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_videos_description_trgm ON videos USING GIN (description gin_trgm_ops);

-- GIN indexes for fuzzy text search on sources
CREATE INDEX IF NOT EXISTS idx_sources_name_trgm ON sources USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sources_description_trgm ON sources USING GIN (description gin_trgm_ops);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Profiles: Users can only see/edit their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Subscriptions: Users can only see their own subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
    ON subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Token usage: Users can only see their own usage
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own token usage"
    ON token_usage FOR SELECT
    USING (auth.uid() = user_id);

-- AI Conversations: Users can only see/manage their own conversations
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
    ON ai_conversations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
    ON ai_conversations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
    ON ai_conversations FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
    ON ai_conversations FOR DELETE
    USING (auth.uid() = user_id);

-- Conversation videos: Users can manage videos in their own conversations
ALTER TABLE conversation_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view videos in own conversations"
    ON conversation_videos FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM ai_conversations
            WHERE id = conversation_videos.conversation_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can add videos to own conversations"
    ON conversation_videos FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM ai_conversations
            WHERE id = conversation_videos.conversation_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can remove videos from own conversations"
    ON conversation_videos FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM ai_conversations
            WHERE id = conversation_videos.conversation_id
            AND user_id = auth.uid()
        )
    );

-- AI Messages: Users can view/create messages in their own conversations
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own conversations"
    ON ai_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM ai_conversations
            WHERE id = ai_messages.conversation_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create messages in own conversations"
    ON ai_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM ai_conversations
            WHERE id = ai_messages.conversation_id
            AND user_id = auth.uid()
        )
    );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to check if user has active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM subscriptions
        WHERE user_id = check_user_id
        AND status = 'active'
        AND (current_period_end IS NULL OR current_period_end > NOW())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's current month token cost
CREATE OR REPLACE FUNCTION public.get_monthly_token_cost(check_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    total_cost DECIMAL;
BEGIN
    SELECT COALESCE(SUM(cost_usd), 0) INTO total_cost
    FROM token_usage
    WHERE user_id = check_user_id
    AND created_at >= DATE_TRUNC('month', NOW());

    RETURN total_cost;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can make AI request (has subscription and under limit)
CREATE OR REPLACE FUNCTION public.can_make_ai_request(check_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    monthly_limit DECIMAL := 4.00; -- $4 USD monthly limit
BEGIN
    -- Check if user has active subscription
    IF NOT public.has_active_subscription(check_user_id) THEN
        RETURN FALSE;
    END IF;

    -- Check if under monthly limit
    IF public.get_monthly_token_cost(check_user_id) >= monthly_limit THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================

CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_subscriptions
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_ai_conversations
    BEFORE UPDATE ON ai_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
