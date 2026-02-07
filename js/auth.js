import { getSupabase, isConfigured } from './supabase.js';
import { getUserTier, TIERS } from './tiers.js';
import { config } from './config.js';

let currentUser = null;
let onAuthChangeCallback = null;

export function getCurrentUser() {
    return currentUser;
}

export function onAuthChange(callback) {
    onAuthChangeCallback = callback;
}

export async function initAuth() {
    if (!isConfigured()) {
        console.log('initAuth: Supabase not configured');
        return null;
    }

    const sb = getSupabase();
    if (!sb) {
        console.log('initAuth: No Supabase client');
        return null;
    }

    // Listen for auth state changes
    sb.auth.onAuthStateChange((event, session) => {
        console.log('initAuth: onAuthStateChange', { event, userId: session?.user?.id });
        currentUser = session?.user || null;
        updateAuthUI();
        if (onAuthChangeCallback) {
            onAuthChangeCallback(currentUser);
        }
    });

    // Check for existing session
    const { data: { session }, error } = await sb.auth.getSession();
    console.log('initAuth: getSession result', { hasSession: !!session, userId: session?.user?.id, error });
    currentUser = session?.user || null;
    return currentUser;
}

export async function signUp(email, password, displayName, username) {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase not configured');

    const metadata = { display_name: displayName };
    if (username) metadata.username = username;

    const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: metadata }
    });

    if (error) throw error;
    return data;
}

export async function signIn(email, password) {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase not configured');

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function signOut() {
    const sb = getSupabase();
    if (!sb) return;

    await sb.auth.signOut();
    currentUser = null;
    updateAuthUI();
}

// Auth UI management
let authOverlay = null;

export function showAuthScreen() {
    if (authOverlay) return;

    authOverlay = document.createElement('div');
    authOverlay.id = 'auth-overlay';
    authOverlay.innerHTML = `
        <div class="auth-panel">
            <h2>Isle Joshua</h2>
            <p class="auth-subtitle">Sign in to create and share maps</p>
            <div id="auth-form-container">
                <div id="auth-signin-form">
                    <input type="email" id="auth-email" placeholder="Email" autocomplete="email" />
                    <input type="password" id="auth-password" placeholder="Password" autocomplete="current-password" />
                    <button id="auth-signin-btn" class="auth-btn auth-btn-primary">Sign In</button>
                    <button id="auth-switch-signup" class="auth-btn auth-btn-link">Don't have an account? Sign Up</button>
                </div>
                <div id="auth-signup-form" style="display: none;">
                    <input type="text" id="auth-display-name" placeholder="Display Name" />
                    <input type="email" id="auth-signup-email" placeholder="Email" autocomplete="email" />
                    <input type="password" id="auth-signup-password" placeholder="Password (min 6 chars)" autocomplete="new-password" />
                    <button id="auth-signup-btn" class="auth-btn auth-btn-primary">Sign Up</button>
                    <button id="auth-switch-signin" class="auth-btn auth-btn-link">Already have an account? Sign In</button>
                </div>
            </div>
            <div id="auth-error" style="display: none;"></div>
            <button id="auth-skip-btn" class="auth-btn auth-btn-secondary">Play as Guest</button>
        </div>
    `;
    document.body.appendChild(authOverlay);

    // Wire up event listeners
    document.getElementById('auth-signin-btn').addEventListener('click', handleSignIn);
    document.getElementById('auth-signup-btn').addEventListener('click', handleSignUp);
    document.getElementById('auth-skip-btn').addEventListener('click', handleSkip);

    document.getElementById('auth-switch-signup').addEventListener('click', () => {
        document.getElementById('auth-signin-form').style.display = 'none';
        document.getElementById('auth-signup-form').style.display = '';
        hideAuthError();
    });

    document.getElementById('auth-switch-signin').addEventListener('click', () => {
        document.getElementById('auth-signup-form').style.display = 'none';
        document.getElementById('auth-signin-form').style.display = '';
        hideAuthError();
    });

    // Enter key support
    authOverlay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const signinVisible = document.getElementById('auth-signin-form').style.display !== 'none';
            if (signinVisible) {
                handleSignIn();
            } else {
                handleSignUp();
            }
        }
    });
}

export function hideAuthScreen() {
    if (authOverlay) {
        authOverlay.remove();
        authOverlay = null;
    }
}

function showAuthError(message) {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
}

function hideAuthError() {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
        errorEl.style.display = 'none';
    }
}

async function handleSignIn() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    if (!email || !password) {
        showAuthError('Please enter email and password.');
        return;
    }

    try {
        document.getElementById('auth-signin-btn').disabled = true;
        document.getElementById('auth-signin-btn').textContent = 'Signing in...';
        await signIn(email, password);
        hideAuthScreen();
    } catch (err) {
        showAuthError(err.message);
    } finally {
        const btn = document.getElementById('auth-signin-btn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Sign In';
        }
    }
}

async function handleSignUp() {
    const displayName = document.getElementById('auth-display-name').value.trim();
    const email = document.getElementById('auth-signup-email').value.trim();
    const password = document.getElementById('auth-signup-password').value;

    if (!email || !password) {
        showAuthError('Please enter email and password.');
        return;
    }
    if (password.length < 6) {
        showAuthError('Password must be at least 6 characters.');
        return;
    }

    try {
        document.getElementById('auth-signup-btn').disabled = true;
        document.getElementById('auth-signup-btn').textContent = 'Signing up...';
        await signUp(email, password, displayName || email.split('@')[0]);
        hideAuthScreen();
    } catch (err) {
        showAuthError(err.message);
    } finally {
        const btn = document.getElementById('auth-signup-btn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Sign Up';
        }
    }
}

function handleSkip() {
    hideAuthScreen();
    if (onAuthChangeCallback) {
        onAuthChangeCallback(null); // null = guest
    }
}

function updateAuthUI() {
    const userIndicator = document.getElementById('auth-user-indicator');
    if (!userIndicator) return;

    if (currentUser) {
        const name = currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || 'User';
        userIndicator.innerHTML = `
            <span class="auth-user-name">${name}</span>
            <button id="auth-signout-btn" class="auth-user-btn">Sign Out</button>
        `;
        userIndicator.style.display = 'flex';
        document.getElementById('auth-signout-btn').addEventListener('click', signOut);
    } else {
        userIndicator.innerHTML = `
            <span class="auth-user-name">Guest</span>
            <button id="auth-login-btn" class="auth-user-btn">Sign In</button>
        `;
        userIndicator.style.display = 'flex';
        document.getElementById('auth-login-btn').addEventListener('click', showAuthScreen);
    }
}

/**
 * Update the header bar with tier-specific UI.
 * Call this after window.currentMapProfile is set and the user is the owner.
 */
export function updateHeaderForTier() {
    const userIndicator = document.getElementById('auth-user-indicator');
    if (!userIndicator || !currentUser) return;

    const profile = window.currentMapProfile;
    if (!profile) return;

    const tier = getUserTier();
    const name = currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || 'User';

    // Check if subscription is canceling (active but ending)
    const isCanceling = profile.subscription_status === 'active' && profile.subscription_ends_at;
    const endsAt = profile.subscription_ends_at ? new Date(profile.subscription_ends_at) : null;
    const endsAtStr = endsAt ? endsAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

    if (tier === TIERS.PAID) {
        // Paid user: clickable name opens Change Plan dialog
        userIndicator.innerHTML = `
            <button id="auth-change-plan-btn" class="auth-user-name-btn" title="Change Plan">${name}</button>
            ${isCanceling ? `<span class="auth-plan-ending">Plan ends ${endsAtStr}</span>` : ''}
            <button id="auth-signout-btn" class="auth-user-btn">Sign Out</button>
        `;
        document.getElementById('auth-change-plan-btn').addEventListener('click', showChangePlanDialog);
        document.getElementById('auth-signout-btn').addEventListener('click', signOut);
    } else {
        // Free user: show upgrade CTA
        userIndicator.innerHTML = `
            <span class="auth-user-name">${name}</span>
            <button id="auth-upgrade-btn" class="auth-upgrade-btn">Upgrade</button>
            <button id="auth-signout-btn" class="auth-user-btn">Sign Out</button>
        `;
        document.getElementById('auth-upgrade-btn').addEventListener('click', () => {
            showChangePlanDialog();
        });
        document.getElementById('auth-signout-btn').addEventListener('click', signOut);
    }

    userIndicator.style.display = 'flex';
}

/**
 * Show the Change Plan dialog. Shows current plan and allows switching.
 */
function showChangePlanDialog() {
    const existing = document.getElementById('change-plan-dialog');
    if (existing) existing.remove();

    const profile = window.currentMapProfile;
    const tier = getUserTier();
    const isCanceling = profile?.subscription_status === 'active' && profile?.subscription_ends_at;
    const endsAt = profile?.subscription_ends_at ? new Date(profile.subscription_ends_at) : null;
    const endsAtStr = endsAt ? endsAt.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '';

    const dialog = document.createElement('div');
    dialog.id = 'change-plan-dialog';

    // Determine which plan option is current/active
    const isFreeCurrent = tier === TIERS.FREE;
    const isPaidCurrent = tier === TIERS.PAID;

    dialog.innerHTML = `
        <div class="cloud-save-panel change-plan-panel">
            <h3>Change Plan</h3>

            <div class="plan-options">
                <div class="plan-option ${isFreeCurrent ? 'plan-current' : ''}" id="plan-option-free">
                    <div class="plan-option-header">
                        <span class="plan-option-name">Free</span>
                        <span class="plan-option-price">$0</span>
                    </div>
                    <ul class="plan-option-features">
                        <li>Map size: 50 x 30</li>
                        <li>Basic terrain & resource tools</li>
                    </ul>
                    ${isFreeCurrent
                        ? '<span class="plan-option-badge">Current Plan</span>'
                        : isCanceling
                            ? `<span class="plan-option-badge plan-ending-badge">Switching ${endsAtStr}</span>`
                            : '<button class="plan-option-btn plan-option-btn-secondary" id="plan-select-free">Switch to Free</button>'
                    }
                </div>

                <div class="plan-option ${isPaidCurrent && !isCanceling ? 'plan-current' : ''}" id="plan-option-paid">
                    <div class="plan-option-header">
                        <span class="plan-option-name">Early Bird</span>
                        <span class="plan-option-price" id="plan-paid-price">Loading...</span>
                    </div>
                    <ul class="plan-option-features">
                        <li>Map size: up to 100 x 60</li>
                        <li>NPCs & structures</li>
                        <li>All editor tools</li>
                    </ul>
                    ${isPaidCurrent && !isCanceling
                        ? '<span class="plan-option-badge">Current Plan</span>'
                        : isFreeCurrent || isCanceling
                            ? '<button class="plan-option-btn plan-option-btn-primary" id="plan-select-paid">Subscribe</button>'
                            : ''
                    }
                </div>
            </div>

            <div class="cloud-save-actions">
                <button id="change-plan-close" class="auth-btn auth-btn-secondary">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    // Fetch the real price from Stripe
    fetchPaidPlanPrice();

    // Wire up close
    document.getElementById('change-plan-close').addEventListener('click', () => {
        dialog.remove();
    });

    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.remove();
    });

    // Wire up free plan selection (downgrade)
    const freeBtn = document.getElementById('plan-select-free');
    if (freeBtn) {
        freeBtn.addEventListener('click', () => handleDowngradeToFree(dialog));
    }

    // Wire up paid plan selection (upgrade)
    const paidBtn = document.getElementById('plan-select-paid');
    if (paidBtn) {
        paidBtn.addEventListener('click', () => handleUpgradeToPaid(dialog));
    }
}

/**
 * Fetch the paid plan price from Stripe and update the dialog.
 */
async function fetchPaidPlanPrice() {
    const priceEl = document.getElementById('plan-paid-price');
    if (!priceEl) return;

    try {
        const response = await fetch('/api/get-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priceIds: [config.STRIPE_PRICE_EARLY_BIRD] })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.prices && data.prices.length > 0) {
                const price = data.prices[0];
                const amount = (price.unitAmount / 100).toFixed(2);
                const currency = price.currency.toUpperCase();
                const interval = price.interval || 'month';
                priceEl.textContent = `$${amount}/${interval}`;
                return;
            }
        }
    } catch (err) {
        console.error('Error fetching price:', err);
    }

    priceEl.textContent = 'See pricing';
}

/**
 * Handle downgrading from paid to free (cancel subscription at period end).
 */
async function handleDowngradeToFree(dialog) {
    const freeBtn = document.getElementById('plan-select-free');
    if (!freeBtn) return;

    // Confirm
    if (!confirm('Switch to Free? You\'ll keep your current plan until the end of this billing period.')) {
        return;
    }

    freeBtn.disabled = true;
    freeBtn.textContent = 'Canceling...';

    try {
        const user = currentUser;
        if (!user) throw new Error('Not signed in');

        const response = await fetch('/api/cancel-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to cancel subscription');
        }

        const result = await response.json();

        // Update the local profile with the end date
        if (window.currentMapProfile && result.endsAt) {
            window.currentMapProfile.subscription_ends_at = result.endsAt;
        }

        dialog.remove();

        // Refresh the header to show the "Plan ends" status
        updateHeaderForTier();

    } catch (err) {
        console.error('Error canceling subscription:', err);
        freeBtn.disabled = false;
        freeBtn.textContent = 'Switch to Free';
        alert('Failed to cancel: ' + err.message);
    }
}

/**
 * Handle upgrading from free to paid (redirect to Stripe checkout).
 */
async function handleUpgradeToPaid(dialog) {
    const paidBtn = document.getElementById('plan-select-paid');
    if (!paidBtn) return;

    paidBtn.disabled = true;
    paidBtn.textContent = 'Redirecting...';

    try {
        const user = currentUser;
        const username = user?.user_metadata?.username || window.currentMapProfile?.username;

        if (!user || !username) {
            throw new Error('Unable to get user info');
        }

        const sb = getSupabase();
        const { data: { session } } = await sb.auth.getSession();
        const accessToken = session?.access_token;

        const response = await fetch('/api/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': config.SUPABASE_ANON_KEY,
                ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
            },
            body: JSON.stringify({
                priceId: config.STRIPE_PRICE_EARLY_BIRD,
                userId: user.id,
                username: username,
                successUrl: `${window.location.origin}/${username}?subscribed=1`,
                cancelUrl: `${window.location.origin}/${username}`
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error);
        if (!data.sessionId) throw new Error('No sessionId returned');

        const stripe = Stripe(config.STRIPE_PUBLISHABLE_KEY);
        const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
        if (error) throw error;

    } catch (err) {
        console.error('Checkout error:', err);
        paidBtn.disabled = false;
        paidBtn.textContent = 'Subscribe';
        alert('Failed to start checkout: ' + err.message);
    }
}
