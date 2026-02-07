// Tier system for free vs paid accounts
// Free tier: limited map size, no NPC or structure (image) tiles
// Paid tier: 4x map area, full access to all editor tools

export const TIERS = {
    FREE: 'free',
    PAID: 'paid'
};

// Map size limits per tier
// Free: 50x30 = 1,500 tiles (current starter island size)
// Paid: 100x60 = 6,000 tiles (4x the area)
export const MAP_SIZE_LIMITS = {
    [TIERS.FREE]: { maxWidth: 50, maxHeight: 30 },
    [TIERS.PAID]: { maxWidth: 100, maxHeight: 60 }
};

// Preset map sizes for the resize dialog
export const MAP_SIZE_PRESETS = [
    { label: 'Small', width: 50, height: 30, tier: TIERS.FREE },
    { label: 'Medium', width: 75, height: 45, tier: TIERS.PAID },
    { label: 'Large', width: 100, height: 60, tier: TIERS.PAID }
];

// Population limits per tier
// FREE: separate hen/rooster caps
// PAID: single total creature cap (any mix of hens, roosters, chicks)
export const POPULATION_LIMITS = {
    [TIERS.FREE]: { maxHens: 5, maxRoosters: 1, maxTotal: Infinity },
    [TIERS.PAID]: { maxHens: Infinity, maxRoosters: Infinity, maxTotal: 50 }
};

// Tool IDs restricted to paid tier
export const PAID_ONLY_TOOLS = ['npc_joshua'];

/**
 * Determine the user's tier based on their profile data.
 * Checks window.currentMapProfile for subscription_status and trial_ends_at.
 * Active subscription or active trial = paid tier, otherwise free.
 */
export function getUserTier() {
    const profile = window.currentMapProfile;
    if (!profile) return TIERS.FREE;

    const subscriptionActive = profile.subscription_status?.toLowerCase() === 'active';
    if (subscriptionActive) return TIERS.PAID;

    const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    const inTrial = trialEndsAt && trialEndsAt > new Date();
    if (inTrial) return TIERS.PAID;

    return TIERS.FREE;
}

/**
 * Check if a tool is restricted to paid tier.
 */
export function isPaidTool(toolId) {
    return PAID_ONLY_TOOLS.includes(toolId);
}

/**
 * Check if a given map size is allowed for the specified tier.
 */
export function canUseMapSize(width, height, tier) {
    const limits = MAP_SIZE_LIMITS[tier || TIERS.FREE];
    return width <= limits.maxWidth && height <= limits.maxHeight;
}

/**
 * Get the maximum map dimensions for a tier.
 */
export function getMaxMapSize(tier) {
    return MAP_SIZE_LIMITS[tier || TIERS.FREE];
}
