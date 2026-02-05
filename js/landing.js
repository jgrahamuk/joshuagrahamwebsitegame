// ── Stripe Configuration ──
// Replace these with your Stripe keys and price IDs
const STRIPE_PUBLISHABLE_KEY = 'YOUR_STRIPE_PUBLISHABLE_KEY';
const STRIPE_PRICE_EARLY_BIRD = 'YOUR_STRIPE_PRICE_ID_EARLY_BIRD'; // $2/mo
const STRIPE_PRICE_STANDARD = 'YOUR_STRIPE_PRICE_ID_STANDARD';     // $5/mo

// Your backend endpoint that creates a Stripe Checkout Session.
// This should be a Supabase Edge Function or similar serverless function.
// It receives { priceId, userId, username } and returns { sessionId }.
const CHECKOUT_API_URL = '/api/create-checkout-session';

// ── Supabase (reuse the same config) ──
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

let sb = null;

function getSupabase() {
    if (!sb && typeof window.supabase !== 'undefined' &&
        SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
        sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return sb;
}

function isSupabaseConfigured() {
    return SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
}

function isStripeConfigured() {
    return STRIPE_PUBLISHABLE_KEY !== 'YOUR_STRIPE_PUBLISHABLE_KEY';
}

// ── State ──
let selectedPlan = 'early_bird';
let usernameCheckTimeout = null;

// ── DOM ──
const modal = document.getElementById('signup-modal');
const modalClose = document.getElementById('modal-close');

const step1 = document.getElementById('signup-step-1');
const stepSignin = document.getElementById('signup-step-signin');
const stepProcessing = document.getElementById('signup-step-processing');

const usernameInput = document.getElementById('signup-username');
const usernameStatus = document.getElementById('username-status');
const emailInput = document.getElementById('signup-email');
const passwordInput = document.getElementById('signup-password');
const signupError = document.getElementById('signup-error');
const signupSubmit = document.getElementById('signup-submit-btn');

const signinEmailInput = document.getElementById('signin-email');
const signinPasswordInput = document.getElementById('signin-password');
const signinError = document.getElementById('signin-error');
const signinSubmit = document.getElementById('signin-submit-btn');

// ── Open/Close Modal ──
function openModal(plan) {
    selectedPlan = plan || 'early_bird';
    modal.style.display = 'flex';
    showStep('signup');
    usernameInput.focus();
}

function closeModal() {
    modal.style.display = 'none';
    clearErrors();
}

function showStep(step) {
    step1.style.display = step === 'signup' ? '' : 'none';
    stepSignin.style.display = step === 'signin' ? '' : 'none';
    stepProcessing.style.display = step === 'processing' ? '' : 'none';
}

function clearErrors() {
    signupError.style.display = 'none';
    signinError.style.display = 'none';
}

// ── Wire up all CTA buttons ──
document.getElementById('hero-signup-btn').addEventListener('click', () => openModal('early_bird'));
document.getElementById('final-signup-btn').addEventListener('click', () => openModal('early_bird'));
document.getElementById('nav-signin-btn').addEventListener('click', () => {
    openModal('early_bird');
    showStep('signin');
});

document.querySelectorAll('.card-cta').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.plan));
});

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

document.getElementById('signup-switch-signin').addEventListener('click', () => {
    clearErrors();
    showStep('signin');
});

document.getElementById('signin-switch-signup').addEventListener('click', () => {
    clearErrors();
    showStep('signup');
});

// ── Username availability check ──
usernameInput.addEventListener('input', () => {
    const raw = usernameInput.value;
    // Sanitize: lowercase, alphanumeric and hyphens only
    const sanitized = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (sanitized !== raw) {
        usernameInput.value = sanitized;
    }

    clearTimeout(usernameCheckTimeout);

    if (sanitized.length < 2) {
        usernameStatus.textContent = '';
        usernameStatus.className = 'input-status';
        return;
    }

    usernameStatus.textContent = 'Checking...';
    usernameStatus.className = 'input-status checking';

    usernameCheckTimeout = setTimeout(() => checkUsername(sanitized), 400);
});

async function checkUsername(username) {
    const client = getSupabase();
    if (!client) {
        // Can't check without Supabase - assume available
        usernameStatus.textContent = `maap.to/${username} is yours!`;
        usernameStatus.className = 'input-status available';
        return;
    }

    const { data, error } = await client
        .from('profiles')
        .select('username')
        .eq('username', username)
        .maybeSingle();

    if (error) {
        usernameStatus.textContent = '';
        usernameStatus.className = 'input-status';
        return;
    }

    if (data) {
        usernameStatus.textContent = 'Already taken';
        usernameStatus.className = 'input-status taken';
    } else {
        usernameStatus.textContent = `maap.to/${username} is yours!`;
        usernameStatus.className = 'input-status available';
    }
}

// ── Signup ──
signupSubmit.addEventListener('click', handleSignup);
passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSignup(); });

async function handleSignup() {
    clearErrors();

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!username || username.length < 2) {
        showError(signupError, 'Username must be at least 2 characters.');
        return;
    }

    if (!email) {
        showError(signupError, 'Please enter your email.');
        return;
    }

    if (!password || password.length < 6) {
        showError(signupError, 'Password must be at least 6 characters.');
        return;
    }

    signupSubmit.disabled = true;
    signupSubmit.textContent = 'Creating account...';

    try {
        const client = getSupabase();
        if (!client) throw new Error('Service not configured yet. Check back soon!');

        // Check username one more time
        const { data: existing } = await client
            .from('profiles')
            .select('username')
            .eq('username', username)
            .maybeSingle();

        if (existing) {
            showError(signupError, 'That username is already taken.');
            return;
        }

        // Create Supabase auth user
        const { data: authData, error: authError } = await client.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: username,
                    username: username
                }
            }
        });

        if (authError) throw authError;

        // Now redirect to Stripe Checkout
        await redirectToCheckout(authData.user?.id, username);

    } catch (err) {
        showError(signupError, err.message);
    } finally {
        signupSubmit.disabled = false;
        signupSubmit.textContent = 'Create Account & Subscribe';
    }
}

// ── Signin ──
signinSubmit.addEventListener('click', handleSignin);
signinPasswordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSignin(); });

async function handleSignin() {
    clearErrors();

    const email = signinEmailInput.value.trim();
    const password = signinPasswordInput.value;

    if (!email || !password) {
        showError(signinError, 'Please enter email and password.');
        return;
    }

    signinSubmit.disabled = true;
    signinSubmit.textContent = 'Signing in...';

    try {
        const client = getSupabase();
        if (!client) throw new Error('Service not configured yet.');

        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Signed in - redirect to their world
        const { data: profile } = await client
            .from('profiles')
            .select('username')
            .eq('id', data.user.id)
            .single();

        if (profile?.username) {
            window.location.href = `/${profile.username}`;
        } else {
            window.location.href = '/game.html';
        }

    } catch (err) {
        showError(signinError, err.message);
    } finally {
        signinSubmit.disabled = false;
        signinSubmit.textContent = 'Sign In';
    }
}

// ── Stripe Checkout ──
async function redirectToCheckout(userId, username) {
    showStep('processing');

    const priceId = selectedPlan === 'early_bird'
        ? STRIPE_PRICE_EARLY_BIRD
        : STRIPE_PRICE_STANDARD;

    if (!isStripeConfigured()) {
        // Stripe not configured yet - just redirect to the game
        console.log('Stripe not configured. Would create checkout with:', {
            priceId,
            userId,
            username,
            plan: selectedPlan
        });
        setTimeout(() => {
            window.location.href = '/game.html';
        }, 1500);
        return;
    }

    try {
        // Call your backend to create a Checkout Session
        const response = await fetch(CHECKOUT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                priceId,
                userId,
                username,
                successUrl: `${window.location.origin}/${username}?welcome=1`,
                cancelUrl: `${window.location.origin}/?canceled=1`
            })
        });

        const { sessionId, error } = await response.json();
        if (error) throw new Error(error);

        // Redirect to Stripe Checkout
        const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
        const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });
        if (stripeError) throw stripeError;

    } catch (err) {
        showStep('signup');
        showError(signupError, 'Checkout failed: ' + err.message);
    }
}

// ── Helpers ──
function showError(el, message) {
    el.textContent = message;
    el.style.display = 'block';
}

// ── Animate preview URL with typed usernames ──
const sampleNames = ['alex', 'maya', 'kai', 'luna', 'jo', 'river', 'sam'];
let nameIndex = 0;
const previewNameEl = document.querySelector('.preview-name');

function cyclePreviewName() {
    if (!previewNameEl) return;
    nameIndex = (nameIndex + 1) % sampleNames.length;
    previewNameEl.style.opacity = '0';
    setTimeout(() => {
        previewNameEl.textContent = sampleNames[nameIndex];
        previewNameEl.style.opacity = '1';
    }, 300);
}

previewNameEl.style.transition = 'opacity 0.3s';
setInterval(cyclePreviewName, 3000);
