import { getSupabase, isConfigured } from './supabase.js';
import { getCurrentUser } from './auth.js';

let browserOverlay = null;
let onMapSelectedCallback = null;

export function onMapSelected(callback) {
    onMapSelectedCallback = callback;
}

export async function fetchMyMaps() {
    const sb = getSupabase();
    const user = getCurrentUser();
    if (!sb || !user) return [];

    const { data, error } = await sb
        .from('maps')
        .select('id, name, description, is_public, created_at, updated_at')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error fetching my maps:', error);
        return [];
    }
    return data || [];
}

export async function fetchPublicMaps() {
    const sb = getSupabase();
    if (!sb) return [];

    const { data, error } = await sb
        .from('maps')
        .select('id, name, description, owner_id, created_at, updated_at, profiles(display_name)')
        .eq('is_public', true)
        .order('updated_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('Error fetching public maps:', error);
        return [];
    }
    return data || [];
}

export async function loadMapById(mapId) {
    const sb = getSupabase();
    if (!sb) return null;

    const { data, error } = await sb
        .from('maps')
        .select('*')
        .eq('id', mapId)
        .single();

    if (error) {
        console.error('Error loading map:', error);
        return null;
    }
    return data;
}

export async function saveMapToSupabase(mapData, name, description, isPublic, existingMapId) {
    const sb = getSupabase();
    const user = getCurrentUser();
    if (!sb || !user) return null;

    if (existingMapId) {
        // Update existing map
        const { data, error } = await sb
            .from('maps')
            .update({
                name,
                description,
                map_data: mapData,
                is_public: isPublic
            })
            .eq('id', existingMapId)
            .eq('owner_id', user.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating map:', error);
            throw error;
        }
        return data;
    } else {
        // Create new map
        const { data, error } = await sb
            .from('maps')
            .insert({
                owner_id: user.id,
                name,
                description,
                map_data: mapData,
                is_public: isPublic
            })
            .select()
            .single();

        if (error) {
            console.error('Error saving map:', error);
            throw error;
        }
        return data;
    }
}

export async function deleteMapFromSupabase(mapId) {
    const sb = getSupabase();
    const user = getCurrentUser();
    if (!sb || !user) return false;

    const { error } = await sb
        .from('maps')
        .delete()
        .eq('id', mapId)
        .eq('owner_id', user.id);

    if (error) {
        console.error('Error deleting map:', error);
        return false;
    }
    return true;
}

export async function showMapBrowser() {
    if (browserOverlay) return;

    browserOverlay = document.createElement('div');
    browserOverlay.id = 'map-browser-overlay';
    browserOverlay.innerHTML = `
        <div class="map-browser-panel">
            <div class="map-browser-header">
                <h2>Maps</h2>
                <button id="map-browser-close" class="map-browser-close-btn">&times;</button>
            </div>
            <div class="map-browser-tabs">
                <button class="map-tab active" data-tab="public">Public Maps</button>
                <button class="map-tab" data-tab="my-maps">My Maps</button>
            </div>
            <div id="map-browser-content" class="map-browser-content">
                <div class="map-browser-loading">Loading maps...</div>
            </div>
            <div class="map-browser-footer">
                <button id="map-browser-default" class="auth-btn auth-btn-secondary">Play Default Map</button>
            </div>
        </div>
    `;
    document.body.appendChild(browserOverlay);

    // Wire up events
    document.getElementById('map-browser-close').addEventListener('click', hideMapBrowser);
    document.getElementById('map-browser-default').addEventListener('click', () => {
        hideMapBrowser();
        if (onMapSelectedCallback) onMapSelectedCallback(null); // null = default map
    });

    // Tab switching
    browserOverlay.querySelectorAll('.map-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            browserOverlay.querySelectorAll('.map-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadTabContent(tab.dataset.tab);
        });
    });

    // Load initial tab
    loadTabContent('public');
}

export function hideMapBrowser() {
    if (browserOverlay) {
        browserOverlay.remove();
        browserOverlay = null;
    }
}

async function loadTabContent(tab) {
    const content = document.getElementById('map-browser-content');
    if (!content) return;

    content.innerHTML = '<div class="map-browser-loading">Loading maps...</div>';

    const user = getCurrentUser();

    if (tab === 'my-maps') {
        if (!user) {
            content.innerHTML = '<div class="map-browser-empty">Sign in to see your maps.</div>';
            return;
        }

        const maps = await fetchMyMaps();
        if (maps.length === 0) {
            content.innerHTML = '<div class="map-browser-empty">No maps yet. Use the map editor to create one!</div>';
            return;
        }
        renderMapList(content, maps, true);
    } else {
        const maps = await fetchPublicMaps();
        if (maps.length === 0) {
            content.innerHTML = '<div class="map-browser-empty">No public maps available yet.</div>';
            return;
        }
        renderMapList(content, maps, false);
    }
}

function renderMapList(container, maps, isOwner) {
    container.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'map-list';

    maps.forEach(mapEntry => {
        const card = document.createElement('div');
        card.className = 'map-card';

        const authorName = mapEntry.profiles?.display_name || 'Unknown';
        const updatedDate = new Date(mapEntry.updated_at).toLocaleDateString();

        card.innerHTML = `
            <div class="map-card-info">
                <div class="map-card-name">${escapeHtml(mapEntry.name)}</div>
                ${mapEntry.description ? `<div class="map-card-desc">${escapeHtml(mapEntry.description)}</div>` : ''}
                <div class="map-card-meta">
                    ${!isOwner ? `by ${escapeHtml(authorName)} &middot; ` : ''}
                    ${updatedDate}
                    ${mapEntry.is_public ? ' &middot; Public' : ' &middot; Private'}
                </div>
            </div>
            <div class="map-card-actions">
                <button class="map-card-play" data-id="${mapEntry.id}">Play</button>
                ${isOwner ? `<button class="map-card-delete" data-id="${mapEntry.id}">Delete</button>` : ''}
            </div>
        `;
        list.appendChild(card);
    });

    container.appendChild(list);

    // Wire up play buttons
    container.querySelectorAll('.map-card-play').forEach(btn => {
        btn.addEventListener('click', async () => {
            const mapId = btn.dataset.id;
            hideMapBrowser();
            if (onMapSelectedCallback) onMapSelectedCallback(mapId);
        });
    });

    // Wire up delete buttons
    container.querySelectorAll('.map-card-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            const mapId = btn.dataset.id;
            if (confirm('Delete this map? This cannot be undone.')) {
                const success = await deleteMapFromSupabase(mapId);
                if (success) {
                    btn.closest('.map-card').remove();
                }
            }
        });
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
