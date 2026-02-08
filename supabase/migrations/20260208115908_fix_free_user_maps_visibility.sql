-- Fix visibility for free users' maps
-- Ensure all maps owned by free-plan users are public
-- Also ensure free users have consistent profile fields

-- Make all existing maps public for free-plan users
UPDATE public.maps m
SET is_public = true
FROM public.profiles p
WHERE m.owner_id = p.id
  AND (p.subscription_plan = 'free' OR p.subscription_plan IS NULL)
  AND m.is_public = false;

-- Normalize free user profiles: set subscription_plan and subscription_status
UPDATE public.profiles
SET subscription_plan = 'free',
    subscription_status = 'free'
WHERE subscription_plan IS NULL
   OR (subscription_plan = 'free' AND subscription_status = 'none');
