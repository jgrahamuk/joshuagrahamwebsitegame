-- Update handle_new_user to support free plan signups without trial
-- Free plan users get subscription_plan = 'free' and no trial_ends_at
-- Paid plan users (early_bird, etc.) still get 7-day trial

create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_plan text;
begin
  user_plan := coalesce(new.raw_user_meta_data->>'plan', 'free');

  insert into public.profiles (id, display_name, username, subscription_status, subscription_plan, trial_ends_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'username',
    case when user_plan = 'free' then 'free' else 'none' end,
    user_plan,
    case when user_plan = 'free' then null
         else now() + interval '7 days'
    end
  );
  return new;
end;
$$ language plpgsql security definer;
