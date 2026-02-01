-- Migration: 7-Day Free Trial System
-- Adds trial tracking and updates digest eligibility to exclude expired trials

-- =============================================================================
-- ADD TRIAL COLUMN TO PROFILES
-- =============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;

-- Backfill existing users: set trial_started_at to their created_at date
-- This means most existing users will have expired trials
UPDATE profiles
SET trial_started_at = created_at
WHERE trial_started_at IS NULL;

-- =============================================================================
-- UPDATE HANDLE_NEW_USER TRIGGER
-- =============================================================================

-- Update trigger to set trial_started_at for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, trial_started_at)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url',
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIAL HELPER FUNCTIONS
-- =============================================================================

-- Check if user's trial is still active (within 7 days of trial_started_at)
CREATE OR REPLACE FUNCTION public.is_trial_active(check_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    trial_start TIMESTAMPTZ;
    trial_days INTEGER := 7;
BEGIN
    SELECT trial_started_at INTO trial_start
    FROM profiles
    WHERE id = check_user_id;

    -- No trial_started_at means no trial (shouldn't happen after backfill)
    IF trial_start IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check if within 7-day window
    RETURN trial_start + (trial_days || ' days')::INTERVAL > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get the trial end date for a user
CREATE OR REPLACE FUNCTION public.get_trial_end_date(check_user_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    trial_start TIMESTAMPTZ;
    trial_days INTEGER := 7;
BEGIN
    SELECT trial_started_at INTO trial_start
    FROM profiles
    WHERE id = check_user_id;

    IF trial_start IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN trial_start + (trial_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has valid access (subscribed OR trial active)
CREATE OR REPLACE FUNCTION public.has_valid_access(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Has active subscription OR is in trial period
    RETURN public.has_active_subscription(check_user_id)
           OR public.is_trial_active(check_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- UPDATE DIGEST ELIGIBILITY FUNCTION
-- =============================================================================

-- Update get_users_for_digest to exclude users with expired trials
CREATE OR REPLACE FUNCTION get_users_for_digest()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    last_digest_sent_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.email,
        p.last_digest_sent_at
    FROM profiles p
    WHERE p.email_digest_enabled = TRUE
    AND p.email IS NOT NULL
    AND (
        p.last_digest_sent_at IS NULL
        OR p.last_digest_sent_at < NOW() - INTERVAL '23 hours'
    )
    -- Only include users with at least one favorite channel
    AND EXISTS (
        SELECT 1 FROM user_favorite_channels ufc
        WHERE ufc.user_id = p.id
    )
    -- Only include users with valid access (subscribed OR trial active)
    AND public.has_valid_access(p.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN profiles.trial_started_at IS 'When the 7-day free trial started for this user';
COMMENT ON FUNCTION public.is_trial_active(UUID) IS 'Returns true if user is within their 7-day trial period';
COMMENT ON FUNCTION public.get_trial_end_date(UUID) IS 'Returns the timestamp when the trial ends';
COMMENT ON FUNCTION public.has_valid_access(UUID) IS 'Returns true if user has active subscription OR active trial';
