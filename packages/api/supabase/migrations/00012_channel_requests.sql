-- Migration: Create channel_requests table for user channel import requests

CREATE TABLE channel_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    channel_input   VARCHAR(500) NOT NULL,  -- Raw URL/handle from user
    status          VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for filtering by status
CREATE INDEX idx_channel_requests_status ON channel_requests(status);

-- Enable Row Level Security
ALTER TABLE channel_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users view own requests" ON channel_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY "Users insert requests" ON channel_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);
