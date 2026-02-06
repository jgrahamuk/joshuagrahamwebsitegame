import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new Error('Stripe secret key not configured')
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Get price IDs from request body or use defaults from env
    const { priceIds } = await req.json().catch(() => ({}))

    // If no price IDs provided, try to get from env
    const pricesToFetch = priceIds || [
      Deno.env.get('STRIPE_PRICE_EARLY_BIRD'),
      Deno.env.get('STRIPE_PRICE_STANDARD'),
    ].filter(Boolean)

    if (!pricesToFetch || pricesToFetch.length === 0) {
      throw new Error('No price IDs provided')
    }

    // Fetch all prices
    const prices = await Promise.all(
      pricesToFetch.map(async (priceId: string) => {
        try {
          const price = await stripe.prices.retrieve(priceId, {
            expand: ['product'],
          })

          const product = price.product as Stripe.Product

          return {
            id: price.id,
            productId: product.id,
            productName: product.name,
            productDescription: product.description,
            unitAmount: price.unit_amount, // in cents
            currency: price.currency,
            interval: price.recurring?.interval,
            intervalCount: price.recurring?.interval_count,
            active: price.active && product.active,
            metadata: {
              ...product.metadata,
              ...price.metadata,
            },
          }
        } catch (err) {
          console.error(`Error fetching price ${priceId}:`, err)
          return null
        }
      })
    )

    // Filter out failed fetches
    const validPrices = prices.filter(Boolean)

    return new Response(
      JSON.stringify({ prices: validPrices }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
