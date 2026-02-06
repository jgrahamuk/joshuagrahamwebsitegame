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
    { type: 'tree.gif', col: 7, row: 3, scale: 1.8 },
    { type: 'farmhouse.gif', col: 4, row: 2, scale: 2 },
];

// Blocked tiles (where objects are)
const blockedTiles = [
    { col: 2, row: 2 },
    { col: 7, row: 3 },
    { col: 4, row: 2 },
    { col: 5, row: 2 },
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
let chickenElement = null;
let chickenPos = { col: 5, row: 4 };
let chickenDir = 'front';
let pecksRemaining = 0;

const chickenSprites = {
    front: 'chicken-front.gif',
    back: 'chicken-back.gif',
    left: 'chicken-left.gif',
    right: 'chicken-right.gif',
    peckLeft: 'chicken-peck-left.gif',
    peckRight: 'chicken-peck-right.gif',
};

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

    // Create chicken element
    chickenElement = createSvgImage(
        chickenSprites[chickenDir],
        offsetX + chickenPos.col * tileSize,
        offsetY + chickenPos.row * tileSize,
        tileSize,
        tileSize
    );
    previewSvg.appendChild(chickenElement);
}

function updateChickenPosition() {
    if (!chickenElement || !previewSvg) return;
    const rect = previewSvg.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    tileSize = Math.min(width / COLS, height / ROWS);
    const offsetX = (width - COLS * tileSize) / 2;
    const offsetY = (height - ROWS * tileSize) / 2;

    chickenElement.setAttribute('x', offsetX + chickenPos.col * tileSize);
    chickenElement.setAttribute('y', offsetY + chickenPos.row * tileSize);
}

function updateChickenSprite(isPecking = false) {
    if (!chickenElement) return;
    let sprite = chickenSprites[chickenDir];
    if (isPecking && (chickenDir === 'left' || chickenDir === 'right')) {
        sprite = chickenDir === 'left' ? chickenSprites.peckLeft : chickenSprites.peckRight;
    }
    chickenElement.setAttribute('href', `resources/images/${sprite}`);
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

// Initialize
if (previewSvg) {
    drawPreviewMap();
    scheduleNextAction();
    window.addEventListener('resize', drawPreviewMap);
}
