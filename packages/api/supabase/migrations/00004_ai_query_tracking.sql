-- Migration: AI Query Tracking
-- Replace token_usage with simpler query-based tracking

-- Create new ai_queries table for tracking individual queries
CREATE TABLE IF NOT EXISTS ai_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'anthropic', 'openai', 'google'
    model TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    video_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ai_queries_user_id ON ai_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_queries_created_at ON ai_queries(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_queries_user_month ON ai_queries(user_id, created_at);

-- RLS policies
ALTER TABLE ai_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own queries"
    ON ai_queries FOR SELECT
    USING (auth.uid() = user_id);

-- Only server can insert (service role)
CREATE POLICY "Service can insert queries"
    ON ai_queries FOR INSERT
    WITH CHECK (true);

-- Function to get user's monthly query count
CREATE OR REPLACE FUNCTION public.get_monthly_query_count(check_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    query_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO query_count
    FROM ai_queries
    WHERE user_id = check_user_id
    AND created_at >= DATE_TRUNC('month', NOW());

    RETURN query_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can make a query (under limit)
CREATE OR REPLACE FUNCTION public.can_make_query(check_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    monthly_limit INTEGER := 200; -- 200 queries per month
BEGIN
    RETURN public.get_monthly_query_count(check_user_id) < monthly_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for user query stats
CREATE OR REPLACE VIEW user_query_stats AS
SELECT
    user_id,
    DATE_TRUNC('month', created_at) AS month,
    COUNT(*) AS total_queries,
    SUM(input_tokens) AS total_input_tokens,
    SUM(output_tokens) AS total_output_tokens,
    array_agg(DISTINCT provider) AS providers_used
FROM ai_queries
GROUP BY user_id, DATE_TRUNC('month', created_at);

-- Grant access to the view
GRANT SELECT ON user_query_stats TO authenticated;
