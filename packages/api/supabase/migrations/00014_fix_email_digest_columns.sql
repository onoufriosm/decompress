-- Fix: Add email digest columns if they don't exist
-- This is a follow-up to 00013 in case the columns weren't added

DO $$
BEGIN
    -- Add email_digest_enabled if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'email_digest_enabled'
    ) THEN
        ALTER TABLE profiles ADD COLUMN email_digest_enabled BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add last_digest_sent_at if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = 'last_digest_sent_at'
    ) THEN
        ALTER TABLE profiles ADD COLUMN last_digest_sent_at TIMESTAMPTZ;
    END IF;
END $$;
