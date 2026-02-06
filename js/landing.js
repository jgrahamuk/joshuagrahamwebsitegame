// ── Configuration ──
import { config } from './config.js';

const STRIPE_PUBLISHABLE_KEY = config.STRIPE_PUBLISHABLE_KEY;
const STRIPE_PRICE_EARLY_BIRD = config.STRIPE_PRICE_EARLY_BIRD;
const STRIPE_PRICE_STANDARD = config.STRIPE_PRICE_STANDARD;

// Supabase Edge Function URLs
// With nginx, /api/ is proxied to your Supabase functions.
const CHECKOUT_API_URL = '/api/create-checkout-session';
const PRICES_API_URL = '/api/get-prices';

// ── Supabase ──
// Uses /api prefix - proxied by server.py (local) or nginx (production)
const SUPABASE_URL = window.location.origin + '/api';
const SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;

let sb = null;

function getSupabase() {
    if (!sb && typeof window.supabase !== 'undefined') {
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
let fetchedPrices = {}; // { early_bird: { id, amount, currency }, standard: { ... } }

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

    // Use fetched price ID if available, otherwise fall back to config
    const priceId = selectedPlan === 'early_bird'
        ? (fetchedPrices.early_bird?.id || STRIPE_PRICE_EARLY_BIRD)
        : (fetchedPrices.standard?.id || STRIPE_PRICE_STANDARD);

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

        if (!response.ok) {
            const text = await response.text();
            console.error('Checkout API error:', response.status, text);
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Checkout API response:', data);

        if (data.error) throw new Error(data.error);
        if (!data.sessionId) throw new Error('No sessionId returned from API');

        // Redirect to Stripe Checkout
        const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
        const { error: stripeError } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
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

if (previewNameEl) {
    previewNameEl.style.transition = 'opacity 0.3s';
    setInterval(cyclePreviewName, 3000);
}

// ── Mini SVG Preview Map ──
const previewSvg = document.getElementById('preview-svg');

// Grid dimensions
const COLS = 10;
const ROWS = 8;

// Island shape (1 = grass, 0 = water)
const islandMap = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

// Objects to place on the map: { type, col, row, scale }
const mapObjects = [
    { type: 'tree.gif', col: 2, row: 2, scale: 1.8 },
    { type: 'pine-tree.gif', col: 7, row: 2, scale: 1.8 },
    { type: 'pine-tree.gif', col: 7, row: 3, scale: 1.8 },
    { type: 'pine-tree.gif', col: 6, row: 2, scale: 1.8 },
    { type: 'pine-tree.gif', col: 3, row: 1, scale: 1.8 },
    { type: 'tree.gif', col: 4, row: 1, scale: 1.8 },
    { type: 'pine-tree.gif', col: 5, row: 1, scale: 1.8 },
    { type: 'farmhouse.gif', col: 4, row: 3, scale: 2.5 },
    { type: 'flower.gif', col: 6, row: 4, scale: 0.8 },
    { type: 'flower.gif', col: 3, row: 5, scale: 0.8 },
    { type: 'flower.gif', col: 5, row: 6, scale: 0.8 },
    { type: 'stone.gif', col: 1, row: 4, scale: 0.75 },
    { type: 'stone.gif', col: 6, row: 5, scale: 0.75 },
];

// Blocked tiles (where objects are)
const blockedTiles = [
    { col: 2, row: 2 },
    { col: 7, row: 3 },
    { col: 4, row: 2 },
    { col: 5, row: 2 },
    { col: 1, row: 4 },
    { col: 6, row: 5 },
];

// Build grass tiles list
const grassTiles = [];
for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
        if (islandMap[row][col] === 1) {
            grassTiles.push({ col, row });
        }
    }
}

function isBlocked(col, row) {
    return blockedTiles.some(t => t.col === col && t.row === row);
}

function isValidTile(col, row) {
    return grassTiles.some(t => t.col === col && t.row === row) && !isBlocked(col, row);
}

// Preview state
let tileSize = 0;
let chickenElements = {}; // One SVG element per sprite
let currentChickenSprite = 'front';
let chickenPos = { col: 5, row: 4 };
let chickenDir = 'front';
let pecksRemaining = 0;

const chickenSpriteNames = {
    front: 'chicken-front.gif',
    back: 'chicken-back.gif',
    left: 'chicken-left.gif',
    right: 'chicken-right.gif',
    peckLeft: 'chicken-peck-left.gif',
    peckRight: 'chicken-peck-right.gif',
};

// Chicken sprite filenames (preloaded on init)
const chickenSprites = { ...chickenSpriteNames };

// Preload chicken sprites into browser cache
function preloadChickenSprites() {
    const promises = Object.values(chickenSpriteNames).map((filename) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = resolve;
            img.src = `resources/images/${filename}`;
        });
    });
    return Promise.all(promises);
}

function createSvgImage(src, x, y, width, height) {
    const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    img.setAttribute('href', `resources/images/${src}`);
    img.setAttribute('x', x);
    img.setAttribute('y', y);
    img.setAttribute('width', width);
    img.setAttribute('height', height);
    img.style.imageRendering = 'pixelated';
    return img;
}

function drawPreviewMap() {
    if (!previewSvg) return;

    const rect = previewSvg.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Calculate tile size
    tileSize = Math.min(width / COLS, height / ROWS);
    const offsetX = (width - COLS * tileSize) / 2;
    const offsetY = (height - ROWS * tileSize) / 2;

    previewSvg.innerHTML = '';
    previewSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // Draw base tiles
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const tile = islandMap[row][col] === 1 ? 'tile-grass.gif' : 'tile-water.gif';
            const img = createSvgImage(
                tile,
                offsetX + col * tileSize,
                offsetY + row * tileSize,
                tileSize,
                tileSize
            );
            previewSvg.appendChild(img);
        }
    }

    // Draw objects
    for (const obj of mapObjects) {
        const scale = obj.scale || 1;
        const objSize = tileSize * scale;
        const offsetAdjust = (objSize - tileSize) / 2;
        const img = createSvgImage(
            obj.type,
            offsetX + obj.col * tileSize - offsetAdjust,
            offsetY + obj.row * tileSize - offsetAdjust,
            objSize,
            objSize
        );
        previewSvg.appendChild(img);
    }

    // Create all chicken sprite elements (75% of tile size, centered in tile)
    const chickenSize = tileSize * 0.75;
    const chickenOffset = (tileSize - chickenSize) / 2;
    const chickenX = offsetX + chickenPos.col * tileSize + chickenOffset;
    const chickenY = offsetY + chickenPos.row * tileSize + chickenOffset;

    chickenElements = {};
    for (const [key, url] of Object.entries(chickenSprites)) {
        const el = createSvgImage(url, chickenX, chickenY, chickenSize, chickenSize);
        el.style.display = key === currentChickenSprite ? 'block' : 'none';
        chickenElements[key] = el;
        previewSvg.appendChild(el);
    }
}

function updateChickenPosition() {
    if (!previewSvg || Object.keys(chickenElements).length === 0) return;
    const rect = previewSvg.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    tileSize = Math.min(width / COLS, height / ROWS);
    const offsetX = (width - COLS * tileSize) / 2;
    const offsetY = (height - ROWS * tileSize) / 2;

    const chickenSize = tileSize * 0.75;
    const chickenOffset = (tileSize - chickenSize) / 2;
    const x = offsetX + chickenPos.col * tileSize + chickenOffset;
    const y = offsetY + chickenPos.row * tileSize + chickenOffset;

    // Update position of all chicken elements
    for (const el of Object.values(chickenElements)) {
        el.setAttribute('x', x);
        el.setAttribute('y', y);
        el.setAttribute('width', chickenSize);
        el.setAttribute('height', chickenSize);
    }
}

function updateChickenSprite(isPecking = false) {
    if (Object.keys(chickenElements).length === 0) return;

    // Determine which sprite to show
    let spriteKey = chickenDir;
    if (isPecking && (chickenDir === 'left' || chickenDir === 'right')) {
        spriteKey = chickenDir === 'left' ? 'peckLeft' : 'peckRight';
    }

    // Hide current, show new
    if (spriteKey !== currentChickenSprite) {
        if (chickenElements[currentChickenSprite]) {
            chickenElements[currentChickenSprite].style.display = 'none';
        }
        if (chickenElements[spriteKey]) {
            chickenElements[spriteKey].style.display = 'block';
        }
        currentChickenSprite = spriteKey;
    }
}

function getAdjacentTiles() {
    const adjacent = [];
    const directions = [
        { dc: 0, dr: -1, dir: 'back' },
        { dc: 0, dr: 1, dir: 'front' },
        { dc: -1, dr: 0, dir: 'left' },
        { dc: 1, dr: 0, dir: 'right' },
    ];
    for (const { dc, dr, dir } of directions) {
        const nc = chickenPos.col + dc;
        const nr = chickenPos.row + dr;
        if (isValidTile(nc, nr)) {
            adjacent.push({ col: nc, row: nr, dir });
        }
    }
    return adjacent;
}

function doPeck() {
    if (pecksRemaining > 0) {
        const isPeckPose = pecksRemaining % 2 === 1;
        updateChickenSprite(isPeckPose);
        pecksRemaining--;
        setTimeout(doPeck, 150 + Math.random() * 100);
    } else {
        updateChickenSprite(false);
        scheduleNextAction();
    }
}

function moveChicken() {
    const adjacent = getAdjacentTiles();
    if (adjacent.length === 0) {
        scheduleNextAction();
        return;
    }

    const target = adjacent[Math.floor(Math.random() * adjacent.length)];
    chickenDir = target.dir;
    chickenPos = { col: target.col, row: target.row };
    updateChickenSprite(false);
    updateChickenPosition();

    // Maybe peck after moving
    if ((chickenDir === 'left' || chickenDir === 'right') && Math.random() > 0.5) {
        pecksRemaining = 2 + Math.floor(Math.random() * 3);
        setTimeout(doPeck, 300);
    } else {
        scheduleNextAction();
    }
}

function scheduleNextAction() {
    setTimeout(moveChicken, 1500 + Math.random() * 2000);
}

// Initialize after sprites are preloaded
if (previewSvg) {
    preloadChickenSprites().then(() => {
        drawPreviewMap();
        scheduleNextAction();
        window.addEventListener('resize', drawPreviewMap);
    });
}

// ── Stripe Dynamic Pricing ──
async function fetchPrices() {
    try {
        // Get price IDs from the config (or pass them to the API)
        const priceIds = [STRIPE_PRICE_EARLY_BIRD, STRIPE_PRICE_STANDARD].filter(
            id => id && !id.startsWith('YOUR_')
        );

        if (priceIds.length === 0) {
            console.log('No Stripe price IDs configured');
            return;
        }

        const response = await fetch(PRICES_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priceIds })
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        // Map prices to our plan structure
        for (const price of data.prices) {
            if (price.id === STRIPE_PRICE_EARLY_BIRD) {
                fetchedPrices.early_bird = {
                    id: price.id,
                    amount: price.unitAmount / 100, // Convert cents to dollars
                    currency: price.currency,
                    interval: price.interval || 'month',
                    name: price.productName
                };
            } else if (price.id === STRIPE_PRICE_STANDARD) {
                fetchedPrices.standard = {
                    id: price.id,
                    amount: price.unitAmount / 100,
                    currency: price.currency,
                    interval: price.interval || 'month',
                    name: price.productName
                };
            }
        }

        updatePricingDisplay();
    } catch (err) {
        console.error('Failed to fetch prices:', err);
        // Prices remain at their default HTML values
    }
}

function formatPrice(amount, currency = 'usd') {
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
    return formatter.format(amount);
}

function updatePricingDisplay() {
    // Update Early Bird card
    if (fetchedPrices.early_bird) {
        const earlyBirdCard = document.querySelector('.pricing-card.early-bird');
        if (earlyBirdCard) {
            const priceAmount = earlyBirdCard.querySelector('.price-amount');
            const ctaButton = earlyBirdCard.querySelector('.card-cta');
            const price = fetchedPrices.early_bird;

            if (priceAmount) {
                priceAmount.textContent = price.amount;
            }
            if (ctaButton) {
                ctaButton.textContent = `Get Started - $${price.amount}/${price.interval === 'year' ? 'yr' : 'mo'}`;
            }
        }
    }

    // Update Standard card
    if (fetchedPrices.standard) {
        const standardCard = document.querySelector('.pricing-card.standard');
        if (standardCard) {
            const priceAmount = standardCard.querySelector('.price-amount');
            const ctaButton = standardCard.querySelector('.card-cta');
            const price = fetchedPrices.standard;

            if (priceAmount) {
                priceAmount.textContent = price.amount;
            }
            if (ctaButton) {
                ctaButton.textContent = `Get Started - $${price.amount}/${price.interval === 'year' ? 'yr' : 'mo'}`;
            }

            // Also update the "after early bird" text on the early bird card
            const earlyBirdCard = document.querySelector('.pricing-card.early-bird');
            if (earlyBirdCard) {
                const originalPrice = earlyBirdCard.querySelector('.price-original');
                if (originalPrice) {
                    originalPrice.textContent = `$${price.amount}/${price.interval === 'year' ? 'year' : 'month'} after early bird ends`;
                }
            }
        }
    }
}

// Fetch prices on page load
fetchPrices();

// ── Local Currency Notice ──
// Show a note for international visitors that local currency is available at checkout
async function detectAndShowCurrencyNotice() {
    try {
        // Use a simple timezone-based detection (no external API needed)
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const usTimezones = ['New_York', 'Chicago', 'Denver', 'Los_Angeles', 'Phoenix', 'Anchorage', 'Honolulu'];
        const isLikelyUS = timezone.startsWith('America/') && usTimezones.some(tz => timezone.includes(tz));

        if (!isLikelyUS) {
            // Add notice to pricing section
            const pricingSection = document.querySelector('.pricing-section');
            if (pricingSection) {
                const notice = document.createElement('p');
                notice.className = 'currency-notice';
                notice.textContent = 'Prices shown in USD. Pay in your local currency at checkout.';
                notice.style.cssText = 'text-align: center; color: #666; font-size: 0.9rem; margin-top: -0.5rem; margin-bottom: 1.5rem;';

                const pricingSub = pricingSection.querySelector('.pricing-sub');
                if (pricingSub) {
                    pricingSub.after(notice);
                }
            }
        }
    } catch (e) {
        // Silently fail - notice is optional
    }
}

detectAndShowCurrencyNotice();

// ── Auto-open signup modal from query param ──
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('signup') === '1') {
    openModal('early_bird');
}

// ── Handle canceled checkout ──
if (urlParams.get('canceled') === '1') {
    showCanceledCheckoutBanner();
}

async function showCanceledCheckoutBanner() {
    const client = getSupabase();
    if (!client) return;

    // Check if user is logged in
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return;

    // Get their username
    const { data: profile } = await client
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .single();

    // Create banner
    const banner = document.createElement('div');
    banner.className = 'canceled-banner';
    banner.innerHTML = `
        <div class="canceled-banner-content">
            <p><strong>Payment not completed.</strong> You can still edit your world, but it won't be visible to others until you subscribe.</p>
            <div class="canceled-banner-actions">
                <button id="canceled-subscribe-btn" class="btn btn-primary btn-sm">Complete Subscription</button>
                ${profile?.username ? `<a href="/${profile.username}" class="btn btn-outline btn-sm">Edit My World Anyway</a>` : ''}
            </div>
        </div>
        <button class="canceled-banner-close">&times;</button>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .canceled-banner {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-bottom: 2px solid #f59e0b;
            padding: 1rem 2rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            z-index: 10000;
            font-family: "Jersey 10", system-ui, sans-serif;
        }
        .canceled-banner-content {
            display: flex;
            align-items: center;
            gap: 1.5rem;
            flex-wrap: wrap;
        }
        .canceled-banner-content p {
            margin: 0;
            color: #e0e0e0;
        }
        .canceled-banner-actions {
            display: flex;
            gap: 0.75rem;
        }
        .canceled-banner-close {
            background: none;
            border: none;
            color: #888;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0.25rem;
        }
        .canceled-banner-close:hover {
            color: #fff;
        }
        body.has-canceled-banner {
            padding-top: 80px;
        }
    `;
    document.head.appendChild(style);
    document.body.classList.add('has-canceled-banner');
    document.body.prepend(banner);

    // Wire up close button
    banner.querySelector('.canceled-banner-close').addEventListener('click', () => {
        banner.remove();
        document.body.classList.remove('has-canceled-banner');
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
    });

    // Wire up subscribe button
    document.getElementById('canceled-subscribe-btn')?.addEventListener('click', () => {
        openModal('early_bird');
        banner.remove();
        document.body.classList.remove('has-canceled-banner');
    });
}

// ── Check auth state and update nav ──
async function checkAuthAndUpdateNav() {
    const client = getSupabase();
    if (!client) return;

    try {
        const { data: { session } } = await client.auth.getSession();

        if (session?.user) {
            // User is logged in - get their username
            const { data: profile } = await client
                .from('profiles')
                .select('username')
                .eq('id', session.user.id)
                .single();

            const navSigninBtn = document.getElementById('nav-signin-btn');
            if (navSigninBtn && profile?.username) {
                // Replace button with a link to their world
                const myMaapLink = document.createElement('a');
                myMaapLink.href = `/${profile.username}`;
                myMaapLink.className = 'btn btn-outline btn-sm';
                myMaapLink.textContent = 'My Maap';
                navSigninBtn.replaceWith(myMaapLink);
            }
        }
    } catch (err) {
        console.error('Error checking auth state:', err);
    }
}

// Check auth on page load
checkAuthAndUpdateNav();
