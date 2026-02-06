import { getSupabase, isConfigured } from './supabase.js';

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
