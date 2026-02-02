-- Migration: Enable email digest by default on new user signup
-- Updates the handle_new_user trigger to set daily_digest_enabled = TRUE

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, daily_digest_enabled)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url',
        TRUE  -- Enable daily digest by default for new users
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger on_auth_user_created already exists and will use this updated function

COMMENT ON FUNCTION public.handle_new_user() IS 'Creates profile for new users with daily_digest_enabled = TRUE by default';
