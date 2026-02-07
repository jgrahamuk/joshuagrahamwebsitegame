// Client-side router for maap.to/username URLs
// nginx routes all non-static paths to game.html, this parses the username
import { getSupabase, isConfigured } from './supabase.js';
import { getCurrentUser } from './auth.js';
import { generateStarterIsland } from './mapGenerator.js';
import { getUserTier, getMaxMapSize } from './tiers.js';

/**
 * Parse the current URL path to get the username
 * Returns: { username: string | null }
 */
export function parseRoute() {
    const path = window.location.pathname;
    const segments = path.split('/').filter(Boolean);

    // No path segments = home/demo
    if (segments.length === 0) {
        return { username: null };
    }

    // game.html = demo mode
    if (segments[0] === 'game.html') {
        return { username: null };
    }

    // "demo" is a reserved name for the demo world
    if (segments[0].toLowerCase() === 'demo') {
        return { username: null, isDemo: true };
    }

    // First segment is the username
    return { username: segments[0].toLowerCase() };
}

/**
 * Look up a user's profile by username
 */
export async function getProfileByUsername(username) {
    if (!isConfigured()) {
        console.log('getProfileByUsername: not configured');
        return null;
    }

    const sb = getSupabase();
    if (!sb) {
        console.log('getProfileByUsername: no supabase client');
        return null;
    }

    console.log('getProfileByUsername: querying for', username);
    const { data, error } = await sb
        .from('profiles')
        .select('id, username, display_name, subscription_status, subscription_plan, trial_ends_at, subscription_ends_at')
        .eq('username', username)
        .limit(1);

    console.log('getProfileByUsername: result', { data, error });

    if (error) {
        console.error('Error fetching profile:', error);
        return null;
    }

    // Handle both array and single object responses
    const profile = Array.isArray(data) ? data[0] : data;
    return profile || null;
}

/**
 * Get a user's primary/default public map
 */
export async function getUserPublicMap(userId) {
    if (!isConfigured()) return null;

    const sb = getSupabase();
    if (!sb) return null;

    const { data, error } = await sb
        .from('maps')
        .select('*')
        .eq('owner_id', userId)
        .eq('is_public', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error fetching user map:', error);
        return null;
    }

    return data;
}

/**
 * Get a user's primary map (any, including private) - for owner access
 */
async function getUserAnyMap(userId) {
    if (!isConfigured()) return null;

    const sb = getSupabase();
    if (!sb) return null;

    const { data, error } = await sb
        .from('maps')
        .select('*')
        .eq('owner_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error fetching user map:', error);
        return null;
    }

    return data;
}

/**
 * Update the page title based on the loaded profile
 */
export function updatePageMeta(profile) {
    if (profile) {
        const displayName = profile.display_name || profile.username;
        document.title = `${displayName}'s World - maap.to`;
    } else {
        document.title = 'maap.to';
    }
}

/**
 * Show a "not found" message
 */
export function showNotFound(message) {
    const overlay = document.createElement('div');
    overlay.id = 'not-found-overlay';
    overlay.innerHTML = `
        <div class="not-found-panel">
            <h2>Not Found</h2>
            <p>${message}</p>
            <a href="/" class="not-found-btn">Go to Homepage</a>
        </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
        #not-found-overlay {
            position: fixed;
            inset: 0;
            background: #0a0a1a;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            font-family: "Jersey 10", system-ui, sans-serif;
        }
        .not-found-panel {
            text-align: center;
            color: #e0e0e0;
        }
        .not-found-panel h2 {
            color: #4caf50;
            font-size: 2rem;
            margin-bottom: 1rem;
        }
        .not-found-panel p {
            color: #888;
            margin-bottom: 2rem;
            max-width: 300px;
        }
        .not-found-btn {
            display: inline-block;
            background: #4caf50;
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            text-decoration: none;
            font-size: 1.1rem;
        }
        .not-found-btn:hover {
            background: #388e3c;
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);
}

/**
 * Main routing function - call this on game.html load
 * Returns the map data to load, or null for default demo
 */
export async function handleRoute() {
    const { username } = parseRoute();

    // No username = demo mode
    if (!username) {
        return { mapData: null, profile: null };
    }

    // Look up the user
    const profile = await getProfileByUsername(username);

    if (!profile) {
        showNotFound("This user doesn't exist.");
        return null;
    }

    // Check if current user is the owner (before subscription check)
    const currentUser = getCurrentUser();
    const isOwner = currentUser && currentUser.id === profile.id;

    // Set profile globally so tier system can use it (needed before createStarterMapForUser)
    if (isOwner) {
        window.currentMapProfile = profile;
    }

    // Check subscription status and trial
    const subscriptionActive = profile.subscription_status?.toLowerCase() === 'active';
    const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    const now = new Date();
    const inTrial = trialEndsAt && trialEndsAt > now;
    const trialDaysRemaining = inTrial ? Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24)) : 0;

    // Debug logging for subscription check
    console.log('Route check:', {
        username,
        profileId: profile.id,
        currentUserId: currentUser?.id,
        isOwner,
        subscriptionStatus: profile.subscription_status,
        trialEndsAt: profile.trial_ends_at,
        inTrial,
        trialDaysRemaining
    });

    // Check access - owners can always access, free plan users are accessible,
    // paid plan users need active subscription or trial
    const paidPlans = ['early_bird', 'standard'];
    const isPaidPlanExpired = paidPlans.includes(profile.subscription_plan) && !subscriptionActive && !inTrial;
    if (isPaidPlanExpired && !isOwner) {
        console.log('Access denied: paid plan expired and not owner');
        showNotFound("This user's subscription has expired.");
        return null;
    }

    // Get their map (public for visitors, any for owner)
    let map = isOwner
        ? await getUserAnyMap(profile.id)
        : await getUserPublicMap(profile.id);

    if (!map) {
        // No map exists - owner can create one
        if (isOwner) {
            // Owner is viewing their own page - create a starter map
            console.log('Creating starter map for user:', profile.username);
            map = await createStarterMapForUser(profile.id);

            if (!map) {
                showNotFound("Failed to create your world. Please try again.");
                return null;
            }
        } else {
            // Visitor viewing someone else's empty page
            showNotFound("This user hasn't published a world yet.");
            return null;
        }
    }

    updatePageMeta(profile);

    return {
        mapData: map.map_data,
        mapId: map.id,
        profile,
        isOwner,
        subscriptionActive,
        inTrial,
        trialDaysRemaining,
    };
}

/**
 * Fetch the current signed-in user's profile (for tier/subscription info)
 */
export async function fetchCurrentUserProfile() {
    if (!isConfigured()) return null;

    const user = getCurrentUser();
    if (!user) return null;

    const sb = getSupabase();
    if (!sb) return null;

    const { data, error } = await sb
        .from('profiles')
        .select('id, username, display_name, subscription_status, subscription_plan, trial_ends_at, subscription_ends_at')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error('Error fetching current user profile:', error);
        return null;
    }

    return data;
}

/**
 * Create a starter map for a user
 */
async function createStarterMapForUser(userId) {
    const sb = getSupabase();
    if (!sb) return null;

    // Use tier-appropriate map size
    const tier = getUserTier();
    const maxSize = getMaxMapSize(tier);
    const starterMap = generateStarterIsland(maxSize.maxWidth, maxSize.maxHeight);

    const { data, error } = await sb
        .from('maps')
        .insert({
            owner_id: userId,
            name: 'My World',
            description: '',
            map_data: starterMap,
            is_public: true
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating starter map:', error);
        return null;
    }

    return data;
}
