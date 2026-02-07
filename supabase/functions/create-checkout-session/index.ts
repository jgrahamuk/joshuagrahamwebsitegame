import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    console.log("STRIPE_SECRET_KEY present:", !!stripeKey);
    console.log("STRIPE_SECRET_KEY prefix:", stripeKey ? stripeKey.substring(0, 7) + "..." : "MISSING");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    console.log("SUPABASE_URL:", supabaseUrl || "MISSING");
    console.log("SUPABASE_SERVICE_ROLE_KEY present:", !!supabaseServiceKey);

    const stripe = new Stripe(stripeKey || "", {
      apiVersion: "2023-10-16",
    });

    const supabase = createClient(supabaseUrl || "", supabaseServiceKey || "");

    const { priceId, userId, username, successUrl, cancelUrl } = await req.json();

    if (!priceId || !userId || !username) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: priceId, userId, username" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, username, trial_ends_at")
      .eq("id", userId)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // Get user email from auth
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);

      const customer = await stripe.customers.create({
        email: user?.email,
        metadata: {
          supabase_user_id: userId,
          username: username,
        },
      });
      customerId = customer.id;

      // Save customer ID to profile
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
    }

    // Calculate trial end for Stripe (if user is still in trial)
    let trialEnd: number | undefined;
    if (profile?.trial_ends_at) {
      const trialEndsAt = new Date(profile.trial_ends_at);
      const now = new Date();
      if (trialEndsAt > now) {
        // Stripe expects Unix timestamp in seconds
        trialEnd = Math.floor(trialEndsAt.getTime() / 1000);
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: successUrl || `${req.headers.get("origin")}/${username}?welcome=1`,
      cancel_url: cancelUrl || `${req.headers.get("origin")}/?canceled=1`,
      metadata: {
        supabase_user_id: userId,
        username: username,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: userId,
          username: username,
        },
        // If user is in trial, don't charge until trial ends
        ...(trialEnd && { trial_end: trialEnd }),
      },
    });

    return new Response(
      JSON.stringify({ sessionId: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
