-- ============================================================
-- Migration: Add height_cm to profiles for BAC estimation
-- ============================================================

-- Add height_cm column (NULL = user hasn't configured body metrics)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height_cm REAL DEFAULT NULL;

-- Update trigger to also read height_cm from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, gender, weight_kg, height_cm)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'display_name',
    COALESCE(NEW.raw_user_meta_data->>'gender', 'other'),
    COALESCE((NEW.raw_user_meta_data->>'weight_kg')::REAL, 70),
    (NEW.raw_user_meta_data->>'height_cm')::REAL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
