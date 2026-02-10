-- Migration: Security Policy Fixes
-- Defense-in-depth RLS policies for operations not currently used by client

-- =============================================================================
-- PROFILES: Deny deletion (service role handles if needed)
-- =============================================================================

CREATE POLICY "Profiles cannot be deleted by users"
    ON profiles FOR DELETE
    USING (false);

-- =============================================================================
-- SUBSCRIPTIONS: Deny all modifications (managed by Stripe webhooks only)
-- =============================================================================

CREATE POLICY "Users cannot insert subscriptions"
    ON subscriptions FOR INSERT
    WITH CHECK (false);

CREATE POLICY "Users cannot update subscriptions"
    ON subscriptions FOR UPDATE
    USING (false);

CREATE POLICY "Users cannot delete subscriptions"
    ON subscriptions FOR DELETE
    USING (false);

-- =============================================================================
-- AI QUERIES: Fix overly permissive INSERT policy
-- =============================================================================

-- Drop the permissive policy that allows inserting for any user_id
DROP POLICY IF EXISTS "Service can insert queries" ON ai_queries;

-- Create restrictive policy: users can only insert queries with their own user_id
CREATE POLICY "Users can only insert own queries"
    ON ai_queries FOR INSERT
    WITH CHECK (auth.uid() = user_id);
