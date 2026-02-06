-- Add trial period support
-- Adds trial_ends_at column and updates the trigger to set 7-day trial on signup

-- Add trial_ends_at column to profiles
alter table public.profiles
  add column if not exists trial_ends_at timestamptz;

-- Update the handle_new_user function to set trial_ends_at
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, username, trial_ends_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'username',
    now() + interval '7 days'  -- 7-day free trial
  );
  return new;
end;
$$ language plpgsql security definer;

-- For existing users without trial_ends_at, optionally give them a trial
-- Uncomment if you want to give existing users a trial:
-- update public.profiles
--   set trial_ends_at = now() + interval '7 days'
--   where trial_ends_at is null and subscription_status != 'active';
