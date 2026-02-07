import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's stripe_customer_id from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id, subscription_status, subscription_plan")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Already active — no need to check Stripe
    if (profile.subscription_status === "active") {
      return new Response(
        JSON.stringify({ active: true, plan: profile.subscription_plan }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.stripe_customer_id) {
      return new Response(
        JSON.stringify({ active: false, error: "No Stripe customer linked" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check Stripe for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // Also check for trialing subscriptions
      const trialingSubs = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: "trialing",
        limit: 1,
      });

      if (trialingSubs.data.length === 0) {
        return new Response(
          JSON.stringify({ active: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Has a trialing subscription — treat as active
      subscriptions.data = trialingSubs.data;
    }

    // Active subscription found in Stripe — update the database
    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price.id;
    const plan = priceId?.includes("early") ? "early_bird" : "standard";

    await supabase.rpc("activate_subscription", {
      p_user_id: userId,
      p_stripe_customer_id: profile.stripe_customer_id,
      p_plan: plan,
    });

    console.log(`Verified and activated subscription for user ${userId}, plan: ${plan}`);

    return new Response(
      JSON.stringify({ active: true, plan }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error verifying subscription:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
