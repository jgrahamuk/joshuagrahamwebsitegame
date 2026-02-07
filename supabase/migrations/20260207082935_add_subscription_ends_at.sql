-- Add subscription_ends_at to track when a canceling subscription expires.
-- While active but cancel_at_period_end, user keeps paid access until this date.
alter table public.profiles
  add column if not exists subscription_ends_at timestamptz;

-- Update cancel_subscription to also clear subscription_ends_at when fully canceled
create or replace function public.cancel_subscription(
  p_stripe_customer_id text
)
returns void as $$
begin
  update public.profiles
  set subscription_status = 'canceled',
      subscription_ends_at = null
  where stripe_customer_id = p_stripe_customer_id;
end;
$$ language plpgsql security definer;
