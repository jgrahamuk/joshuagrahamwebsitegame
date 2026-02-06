import { initializeMap, initializeMapFromData, getTile, randomGrassOrDirt, tileTypes, map, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, setMapSize, drawMap } from './map.js';
import { findPath, moveToTarget } from './movement.js';
import { Player } from './player.js';
import { Chicken, Cockerel } from './chickens.js';
import { NPC, npcDefinitions } from './npcs.js';
import { preloadSprites, getSpriteUrl } from './spriteCache.js';
import { drawStructures } from './structures.js';
import { MapEditor } from './mapEditor.js';
import { badgeSystem } from './badgeSystem.js';
import { isConfigured } from './supabase.js';
import { initAuth, onAuthChange, showAuthScreen, getCurrentUser } from './auth.js';
import { showMapBrowser, onMapSelected } from './mapBrowser.js';
import { loadMapFromSupabase, convertMapDataToGameFormat } from './mapLoader.js';
import { handleRoute, parseRoute } from './router.js';
import { config } from './config.js';
import { generateStarterIsland } from './mapGenerator.js';
import { fetchMyMaps, saveMapToSupabase } from './mapBrowser.js';

// Add at the start of the file, before any other code
function updateOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth;
    const orientation = isPortrait ? 'portrait' : 'landscape';

    // Update body class for CSS targeting
    document.body.classList.remove('portrait', 'landscape');
    document.body.classList.add(orientation);
}

// Call on load and resize
window.addEventListener('load', updateOrientation);
window.addEventListener('resize', updateOrientation);

// Game objectives system
class ObjectiveSystem {
    constructor(svg) {
        this.svg = svg;
        this.currentObjective = null;
        this.objectives = [
            {
                id: 'talk_to_joshua',
                description: 'Talk to Joshua',
                target: () => window.npcs.find(npc => npc.name.toLowerCase() === 'joshua'),
                isComplete: () => window.npcs.find(npc => npc.name.toLowerCase() === 'joshua')?.hasSpokenTo,
                getPosition: () => {
                    const joshua = window.npcs.find(npc => npc.name.toLowerCase() === 'joshua');
                    return joshua ? { x: joshua.x, y: joshua.y } : null;
                },
                initialDelay: 5000 // 5 second delay after intro
            },
            {
                id: 'find_first_badge',
                description: 'Find your first badge',
                target: () => {
                    // Find the first badge on the map
                    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
                        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
                            const tiles = map[y][x];
                            if (tiles[tiles.length - 1] === tileTypes.BADGE) {
                                return { x, y };
                            }
                        }
                    }
                    return null;
                },
                isComplete: () => window.player.inventory.badges > 0,
                getPosition: function () { return this.target(); },
                delay: 10000 // Show arrow after 10 seconds
            }
        ];

        // Create the guidance arrow
        this.arrow = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        this.arrow.setAttribute('href', getSpriteUrl('arrow.gif'));
        this.arrow.setAttribute('width', window.TILE_SIZE);
        this.arrow.setAttribute('height', window.TILE_SIZE);
        this.arrow.style.imageRendering = 'pixelated';
        this.arrow.style.display = 'none';
        this.svg.appendChild(this.arrow);

        // Animation state
        this.bounceHeight = window.TILE_SIZE * 0.3;
        this.lastBounceSequence = 0;
        this.bounceSequenceDelay = 2000; // 2 seconds between sequences
        this.bounceSequenceDuration = 1200; // 1.2 seconds for the bounce sequence
        this.isBouncingSequence = false;
        this.bounceSequenceStartTime = 0;
        this.waitingForIntro = true;

        // Start the first objective (but don't show arrow yet)
        this.startNextObjective();
    }

    startNextObjective() {
        // Find the first incomplete objective
        this.currentObjective = this.objectives.find(obj => !obj.isComplete());

        if (this.currentObjective) {
            console.log(`Starting objective: ${this.currentObjective.description}`);

            // Hide arrow initially
            this.arrow.style.display = 'none';

            // If this is the first objective and we're waiting for intro
            if (this.currentObjective.id === 'talk_to_joshua' && this.waitingForIntro) {
                // Wait for intro to finish plus initial delay
                const checkIntro = () => {
                    if (!window.player.isInIntro) {
                        setTimeout(() => {
                            if (this.currentObjective && !this.currentObjective.isComplete()) {
                                this.waitingForIntro = false;
                                this.arrow.style.display = 'block';
                            }
                        }, this.currentObjective.initialDelay);
                    } else {
                        setTimeout(checkIntro, 100);
                    }
                };
                checkIntro();
            }
            // For subsequent objectives, use their delay property
            else if (this.currentObjective.delay) {
                setTimeout(() => {
                    if (this.currentObjective && !this.currentObjective.isComplete()) {
                        this.arrow.style.display = 'block';
                    }
                }, this.currentObjective.delay);
            } else {
                this.arrow.style.display = 'block';
            }
        } else {
            this.arrow.style.display = 'none';
        }
    }

    updateArrowPosition() {
        if (!this.currentObjective) return;

        const pos = this.currentObjective.getPosition();
        if (!pos) return;

        const now = Date.now();
        const timeSinceLastSequence = now - this.lastBounceSequence;

        // Check if we should start a new bounce sequence
        if (!this.isBouncingSequence && timeSinceLastSequence >= this.bounceSequenceDelay) {
            this.isBouncingSequence = true;
            this.bounceSequenceStartTime = now;
            this.lastBounceSequence = now;
        }

        let bounceOffset = 0;
        // Update bounce state during sequence
        if (this.isBouncingSequence) {
            const sequenceProgress = (now - this.bounceSequenceStartTime) / this.bounceSequenceDuration;

            if (sequenceProgress >= 1) {
                // End of sequence
                this.isBouncingSequence = false;
            } else {
                // Smooth easing for the bounce animation
                const easeInOutProgress = sequenceProgress < 0.5
                    ? 4 * sequenceProgress * sequenceProgress * sequenceProgress
                    : 1 - Math.pow(-2 * sequenceProgress + 2, 3) / 2;

                // Calculate bounce using sine wave - 5 complete cycles with smooth easing
                bounceOffset = Math.sin(easeInOutProgress * Math.PI * 10) * this.bounceHeight;
            }
        }

        // Determine target width (NPCs are 2 tiles wide, badges/items are 1 tile)
        const isNPC = this.currentObjective.id === 'talk_to_joshua';
        const targetWidth = isNPC ? window.TILE_SIZE * 2 : window.TILE_SIZE;

        // Position arrow above the target, centered
        const targetX = (window.MAP_OFFSET_X || 0) + (pos.x * window.TILE_SIZE);
        const arrowX = targetX + (targetWidth / 2) - (window.TILE_SIZE / 2);
        const arrowY = (window.MAP_OFFSET_Y || 0) + (pos.y * window.TILE_SIZE) - window.TILE_SIZE - bounceOffset;

        this.arrow.setAttribute('x', arrowX);
        this.arrow.setAttribute('y', arrowY);
    }

    tick() {
        // Check if current objective is complete
        if (this.currentObjective?.isComplete()) {
            this.startNextObjective();
        }

        // Update arrow position
        if (this.currentObjective && this.arrow.style.display !== 'none') {
            this.updateArrowPosition();
        }
    }
}

window.TILE_SIZE = 40;
window.MAP_OFFSET_X = 0;
window.MAP_OFFSET_Y = 0;

// Show banner for unpaid owners
function showUnpaidOwnerBanner() {
    const banner = document.createElement('div');
    banner.id = 'unpaid-owner-banner';
    banner.innerHTML = `
        <div class="unpaid-banner-content">
            <span>Your world is not visible to others until you subscribe.</span>
            <button class="unpaid-banner-btn" id="subscribe-now-btn">Subscribe Now</button>
        </div>
        <button class="unpaid-banner-close">&times;</button>
    `;

    const style = document.createElement('style');
    style.textContent = `
        #unpaid-owner-banner {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-bottom: 2px solid #f59e0b;
            padding: 0.75rem 1.5rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            z-index: 10000;
            font-family: "Jersey 10", system-ui, sans-serif;
            color: #e0e0e0;
        }
        .unpaid-banner-content {
            display: flex;
            align-items: center;
            gap: 1rem;
            flex-wrap: wrap;
        }
        .unpaid-banner-btn {
            background: #4CAF50;
            color: white;
            padding: 0.4rem 1rem;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-family: inherit;
            font-size: 0.95rem;
        }
        .unpaid-banner-btn:hover {
            background: #388e3c;
        }
        .unpaid-banner-btn:disabled {
            background: #666;
            cursor: wait;
        }
        .unpaid-banner-close {
            background: none;
            border: none;
            color: #888;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0.25rem;
        }
        .unpaid-banner-close:hover {
            color: #fff;
        }
    `;
    document.head.appendChild(style);
    document.body.prepend(banner);

    banner.querySelector('.unpaid-banner-close').addEventListener('click', () => {
        banner.remove();
    });

    // Subscribe button - go directly to Stripe
    document.getElementById('subscribe-now-btn').addEventListener('click', async (e) => {
        const btn = e.target;
        btn.disabled = true;
        btn.textContent = 'Redirecting...';

        try {
            const user = getCurrentUser();
            const username = user?.user_metadata?.username || window.currentMapProfile?.username;

            if (!user || !username) {
                throw new Error('Unable to get user info');
            }

            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceId: config.STRIPE_PRICE_EARLY_BIRD,
                    userId: user.id,
                    username: username,
                    successUrl: `${window.location.origin}/${username}?welcome=1`,
                    cancelUrl: `${window.location.origin}/${username}?canceled=1`
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
            btn.disabled = false;
            btn.textContent = 'Subscribe Now';
            alert('Failed to start checkout: ' + err.message);
        }
    });
}

// Show trial banner with days remaining
function showTrialBanner(daysRemaining) {
    const banner = document.createElement('div');
    banner.id = 'trial-banner';

    // Handle missing or invalid daysRemaining
    const days = daysRemaining || 7; // Default to 7 if not set
    const daysText = days === 1 ? '1 day' : `${days} days`;
    banner.innerHTML = `
        <div class="trial-banner-content">
            <span>Free trial: <strong>${daysText}</strong> remaining</span>
            <button class="trial-banner-btn" id="add-payment-btn">Add Payment Method</button>
        </div>
        <button class="trial-banner-close">&times;</button>
    `;

    const style = document.createElement('style');
    style.textContent = `
        #trial-banner {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%);
            border-bottom: 2px solid #4CAF50;
            padding: 0.75rem 1.5rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            z-index: 10000;
            font-family: "Jersey 10", system-ui, sans-serif;
            color: #e0e0e0;
        }
        .trial-banner-content {
            display: flex;
            align-items: center;
            gap: 1rem;
            flex-wrap: wrap;
        }
        .trial-banner-btn {
            background: #4CAF50;
            color: white;
            padding: 0.4rem 1rem;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-family: inherit;
            font-size: 0.95rem;
        }
        .trial-banner-btn:hover {
            background: #388e3c;
        }
        .trial-banner-btn:disabled {
            background: #666;
            cursor: wait;
        }
        .trial-banner-close {
            background: none;
            border: none;
            color: #888;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0.25rem;
        }
        .trial-banner-close:hover {
            color: #fff;
        }
    `;
    document.head.appendChild(style);
    document.body.prepend(banner);

    banner.querySelector('.trial-banner-close').addEventListener('click', () => {
        banner.remove();
    });

    // Add payment button - go to Stripe
    document.getElementById('add-payment-btn').addEventListener('click', async (e) => {
        const btn = e.target;
        btn.disabled = true;
        btn.textContent = 'Redirecting...';

        try {
            const user = getCurrentUser();
            const username = user?.user_metadata?.username || window.currentMapProfile?.username;

            if (!user || !username) {
                throw new Error('Unable to get user info');
            }

            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            btn.disabled = false;
            btn.textContent = 'Add Payment Method';
            alert('Failed to start checkout: ' + err.message);
        }
    });
}

const gameContainer = document.getElementById('game-container');
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
gameContainer.appendChild(svg);

// Make SVG globally accessible
window.svg = svg;

// Game loop timing constants
const FRAME_TIME = 1000 / 60; // Target 60 FPS
const TICK_INTERVAL = 50; // 50ms between game logic updates

// Game loop timing variables
let lastFrameTime = 0;
let lastTickTime = 0;

// Mobile viewport settings
const MOBILE_BREAKPOINT = 768;
const MOBILE_VISIBLE_TILES = 24; // How many tiles to show along the longest screen dimension

function isMobileView() {
    return window.innerWidth < MOBILE_BREAKPOINT;
}

function updateTileSize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Check if we should use mobile viewport
    window.mobileViewport = isMobileView();

    console.log('updateTileSize:', { w, h, isMobile: window.mobileViewport, breakpoint: MOBILE_BREAKPOINT });

    if (window.mobileViewport) {
        // Mobile: calculate tile size based on the longer screen dimension
        // In portrait (h > w), fit tiles to height; in landscape, fit to width
        // This ensures tiles are large enough to see and interact with
        const isPortrait = h > w;
        if (isPortrait) {
            window.TILE_SIZE = h / MOBILE_VISIBLE_TILES;
        } else {
            window.TILE_SIZE = w / MOBILE_VISIBLE_TILES;
        }
        console.log('Mobile tile size:', { isPortrait, tileSize: window.TILE_SIZE, visibleTiles: MOBILE_VISIBLE_TILES });

        // Set initial offsets to center the map (will be updated by updateViewport when player exists)
        const mapPixelWidth = MAP_WIDTH_TILES * window.TILE_SIZE;
        const mapPixelHeight = MAP_HEIGHT_TILES * window.TILE_SIZE;
        window.MAP_OFFSET_X = (w - mapPixelWidth) / 2;
        window.MAP_OFFSET_Y = (h - mapPixelHeight) / 2;
    } else {
        // Desktop: fit entire map width on screen
        window.TILE_SIZE = w / MAP_WIDTH_TILES;
        console.log('Desktop tile size:', { tileSize: window.TILE_SIZE, mapWidth: MAP_WIDTH_TILES });

        // Center the map vertically
        const mapPixelHeight = MAP_HEIGHT_TILES * window.TILE_SIZE;
        window.MAP_OFFSET_X = 0;
        window.MAP_OFFSET_Y = Math.max(0, (h - mapPixelHeight) / 2);
    }

    // Set SVG size to fill the entire screen
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);

    // Reset positioning
    svg.style.position = 'static';
    svg.style.left = '';
    svg.style.top = '';
}

// Update viewport to center on player (for mobile)
function updateViewport() {
    if (!window.mobileViewport || !window.player) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const tileSize = window.TILE_SIZE;

    // Calculate map dimensions in pixels
    const mapPixelWidth = MAP_WIDTH_TILES * tileSize;
    const mapPixelHeight = MAP_HEIGHT_TILES * tileSize;

    // Calculate player's pixel position (center of player tile)
    const playerCenterX = (window.player.x + 1) * tileSize; // +1 because player sprite is 2 tiles wide
    const playerCenterY = (window.player.y + 1) * tileSize;

    // Calculate offset to center player on screen
    let offsetX = (w / 2) - playerCenterX;
    let offsetY = (h / 2) - playerCenterY;

    // Clamp offsets to keep map edges from showing empty space
    // Don't scroll past right edge of map
    offsetX = Math.min(offsetX, 0);
    // Don't scroll past left edge of map
    offsetX = Math.max(offsetX, w - mapPixelWidth);
    // Don't scroll past bottom edge of map
    offsetY = Math.min(offsetY, 0);
    // Don't scroll past top edge of map
    offsetY = Math.max(offsetY, h - mapPixelHeight);

    window.MAP_OFFSET_X = offsetX;
    window.MAP_OFFSET_Y = offsetY;

    // Redraw map with new offsets
    window.drawMap();

    // Redraw player and entities with new positions
    if (window.player) window.player.updatePosition();
    if (window.npcs) window.npcs.forEach(npc => npc.updatePosition());
    if (window.chickens) window.chickens.forEach(c => c.updatePosition());
    if (window.cockerels) window.cockerels.forEach(c => c.updatePosition());
    if (window.chicks) window.chicks.forEach(c => c.updatePosition());
}

// Make updateViewport globally accessible
window.updateViewport = updateViewport;

// Make drawMap globally accessible (wrapper to use window.svg by default)
window.drawMap = (svgArg) => drawMap(svgArg || window.svg);

function gameLoop(timestamp) {
    // Request next frame first
    requestAnimationFrame(gameLoop);

    // Calculate time since last frame
    const deltaTime = timestamp - lastFrameTime;

    // If enough time has passed, run the frame
    if (deltaTime >= FRAME_TIME) {
        lastFrameTime = timestamp - (deltaTime % FRAME_TIME);

        // Update game logic at fixed intervals
        if (timestamp - lastTickTime >= TICK_INTERVAL) {
            const now = Date.now();
            window.chickens.forEach(c => c.tick(now));
            window.npcs.forEach(n => n.tick(now));
            if (window.chicks) window.chicks.forEach(chick => chick.tick(now));
            if (window.cockerels) window.cockerels.forEach(cockerel => cockerel.tick(now));
            if (window.objectiveSystem) window.objectiveSystem.tick();
            lastTickTime = timestamp;
        }
    }
}

// Start the game with optional Supabase map ID
async function startGame(supabaseMapId) {
    let mapData;

    if (supabaseMapId) {
        // Load map from Supabase
        const supaMapData = await loadMapFromSupabase(supabaseMapId);
        if (supaMapData) {
            mapData = convertMapDataToGameFormat(supaMapData);
            initializeMapFromData(mapData);
        } else {
            // Fall back to default map if Supabase load fails
            mapData = await initializeMap();
        }
    } else {
        mapData = await initializeMap();
    }

    startGameWithMapData(mapData);
}

// Start the game with pre-converted map data
// options: { skipIntro: false, introText: null, pageTitle: null, isOwner: false, isUserWorld: false }
function startGameWithMapData(mapData, options = {}) {
    // Store intro text and page title for map editor
    window.currentMapIntroText = options.introText || mapData.introText || null;
    window.currentMapPageTitle = options.pageTitle || mapData.pageTitle || null;
    window.isMapOwner = options.isOwner || false;

    // Set the page title
    if (window.currentMapPageTitle) {
        document.title = `${window.currentMapPageTitle} - maap.to`;
    }

    updateTileSize();
    drawMap(svg);

    // Update global map reference to point to the current map data
    window.map = map;

    // Create a group for all game entities
    const gameEntitiesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gameEntitiesGroup.setAttribute('id', 'game-entities');
    svg.appendChild(gameEntitiesGroup);

    // Find a valid player start position
    let start;
    if (window.player) {
        // If player exists, check if current position is valid
        const currentTile = getTile(window.player.x, window.player.y);
        if (currentTile === tileTypes.GRASS || currentTile === tileTypes.DIRT) {
            start = { x: window.player.x, y: window.player.y };
        } else {
            start = randomGrassOrDirt();
        }
    } else {
        start = randomGrassOrDirt();
    }

    // Create player with intro options
    const playerOptions = {
        skipIntro: options.skipIntro || options.isOwner || false,
        introText: options.introText || mapData.introText || null
    };
    window.player = new Player(svg, start.x, start.y, playerOptions);

    // Create chickens from loaded data
    window.chickens = [];
    mapData.chickens.forEach(chickenData => {
        const chicken = new Chicken(svg, chickenData.x, chickenData.y);
        window.chickens.push(chicken);
        // Move chicken element to game entities group
        if (chicken.element.parentNode) {
            chicken.element.parentNode.removeChild(chicken.element);
        }
        gameEntitiesGroup.appendChild(chicken.element);
    });

    // Create cockerels from loaded data (if any)
    window.cockerels = [];
    if (mapData.cockerels) {
        mapData.cockerels.forEach(cockerelData => {
            const cockerel = new Cockerel(svg, cockerelData.x, cockerelData.y);
            window.cockerels.push(cockerel);
            // Move cockerel element to game entities group
            if (cockerel.element.parentNode) {
                cockerel.element.parentNode.removeChild(cockerel.element);
            }
            gameEntitiesGroup.appendChild(cockerel.element);
        });
    }

    // Create NPCs from loaded data
    window.npcs = mapData.npcs.map(npcData => {
        const npc = new NPC(svg, npcData.name, npcData.message, npcData.x, npcData.y);
        // Move NPC element to game entities group
        if (npc.element.parentNode) {
            npc.element.parentNode.removeChild(npc.element);
        }
        gameEntitiesGroup.appendChild(npc.element);
        return npc;
    });

    // Initialize map editor (hidden by default)
    window.mapEditor = new MapEditor(svg, gameContainer);

    // Add buttons for demo mode
    if (!options.isUserWorld) {
        // "Get Your Own World" button - top right
        const getWorldButton = document.createElement('button');
        getWorldButton.id = 'demo-get-world-button';
        getWorldButton.textContent = 'Get Your Own World';
        getWorldButton.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 8px;
            font-family: "Jersey 10", system-ui, sans-serif;
            font-size: 1.1rem;
            cursor: pointer;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        getWorldButton.addEventListener('click', () => {
            window.location.href = '/?signup=1';
        });
        document.body.appendChild(getWorldButton);

        // "Edit Map" button - bottom right
        const editButton = document.createElement('button');
        editButton.id = 'demo-edit-button';
        editButton.textContent = 'Edit Map';
        editButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 8px;
            font-family: "Jersey 10", system-ui, sans-serif;
            font-size: 1.1rem;
            cursor: pointer;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        editButton.addEventListener('click', () => {
            window.mapEditor.toggleEditor();
            editButton.textContent = window.mapEditor.isActive ? 'Play Mode' : 'Edit Map';
        });
        document.body.appendChild(editButton);

        // Initialize badge system (only for demo world)
        badgeSystem.initialize();
    }

    // Initialize objective system
    window.objectiveSystem = new ObjectiveSystem(svg);

    // Add intro sequence observer
    const introObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                const isInIntro = window.player.isInIntro;
                gameEntitiesGroup.style.opacity = isInIntro ? '0' : '1';
                gameEntitiesGroup.style.pointerEvents = isInIntro ? 'none' : 'auto';
            }
        });
    });

    // Start observing the player element for style changes
    introObserver.observe(window.player.element, {
        attributes: true,
        attributeFilter: ['style']
    });

    // Center viewport on player for mobile (if skipping intro)
    if (playerOptions.skipIntro) {
        updateViewport();
    }

    // Start the game loop
    requestAnimationFrame(gameLoop);

    // Player movement and interaction - handle both click and touch
    function handleMapInteraction(clientX, clientY) {
        // If player is in intro sequence, ignore map clicks
        if (window.player.isInIntro) return;

        // If map editor is active with a tool selected, let the editor handle clicks
        if (window.mapEditor && window.mapEditor.isActive && window.mapEditor.selectedTool) return;

        const rect = svg.getBoundingClientRect();
        const x = Math.floor((clientX - rect.left - (window.MAP_OFFSET_X || 0)) / window.TILE_SIZE);
        const y = Math.floor((clientY - rect.top - (window.MAP_OFFSET_Y || 0)) / window.TILE_SIZE);

        if (x >= 0 && x < MAP_WIDTH_TILES && y >= 0 && y < MAP_HEIGHT_TILES) {
            // Check if clicking on an NPC or surrounding tiles
            const clickedNPC = window.npcs.find(npc => npc.isClicked(x, y));

            // In edit mode, don't process NPC clicks (let double-click configure them)
            if (window.mapEditor && window.mapEditor.isActive && clickedNPC) {
                return;
            }

            if (clickedNPC && clickedNPC.isNearPlayer(window.player.x, window.player.y)) {
                // Already adjacent - show message immediately
                window.npcs.filter(npc => npc !== clickedNPC).forEach(npc => npc.hideMessage());
                clickedNPC.showMessage();
                return;
            }

            // Check if clicking on a resource - on mobile, also check adjacent tiles for tolerance
            const tile = getTile(x, y);
            if (tile && tile.resource) {
                moveToTarget(x, y, window.player, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, 'resource');
                return;
            }

            // On mobile, check nearby tiles for resources (tap tolerance)
            if (window.mobileViewport) {
                const nearby = [
                    { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
                    { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
                ];
                for (const { dx, dy } of nearby) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && nx < MAP_WIDTH_TILES && ny >= 0 && ny < MAP_HEIGHT_TILES) {
                        const nearTile = getTile(nx, ny);
                        if (nearTile && nearTile.resource) {
                            moveToTarget(nx, ny, window.player, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, 'resource');
                            return;
                        }
                    }
                }
            }

            // Check if clicking on an NPC (not adjacent)
            if (clickedNPC) {
                moveToTarget(x, y, window.player, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, 'npc', clickedNPC);
                return;
            }

            // Otherwise, move to empty tile
            if (tile && tile.passable) {
                moveToTarget(x, y, window.player, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, 'move');
            }
        }

        // Only dismiss NPC messages when NOT clicking on an NPC
        const clickedNPC = window.npcs.find(npc => npc.isClicked(x, y));
        if (!clickedNPC) {
            window.npcs.forEach(npc => npc.hideMessage());
        }
    }

    // Click handler for desktop
    svg.addEventListener('click', (e) => {
        handleMapInteraction(e.clientX, e.clientY);
    });

    // Touch handler for mobile - needed for reliable touch detection on real devices
    let touchHandled = false;
    svg.addEventListener('touchstart', (e) => {
        touchHandled = false;
    });

    svg.addEventListener('touchend', (e) => {
        // Don't handle if player is in intro (let the intro click handler work)
        if (window.player && window.player.isInIntro) return;

        // Don't handle if map editor is active with a tool
        if (window.mapEditor && window.mapEditor.isActive && window.mapEditor.selectedTool) return;

        if (e.changedTouches.length > 0) {
            const touch = e.changedTouches[0];
            console.log('Touch at:', touch.clientX, touch.clientY);
            handleMapInteraction(touch.clientX, touch.clientY);
            touchHandled = true;
            e.preventDefault(); // Prevent click from also firing
        }
    });

    window.addEventListener('resize', async () => {
        const resizeMapData = await initializeMap();
        updateTileSize();
        drawMap(svg);

        // Re-create player at last known position (default to 0,0 if not available)
        let resizeStart = { x: window.player?.x || 0, y: window.player?.y || 0 };
        window.player = new Player(svg, resizeStart.x, resizeStart.y);

        // Re-create chickens
        window.chickens = [];
        resizeMapData.chickens.forEach(chickenData => {
            const chicken = new Chicken(svg, chickenData.x, chickenData.y);
            window.chickens.push(chicken);
        });

        // Re-create cockerels
        window.cockerels = [];
        if (resizeMapData.cockerels) {
            resizeMapData.cockerels.forEach(cockerelData => {
                const cockerel = new Cockerel(svg, cockerelData.x, cockerelData.y);
                window.cockerels.push(cockerel);
            });
        }

        // Re-create NPCs
        window.npcs = resizeMapData.npcs.map(npcData => new NPC(svg, npcData.name, npcData.message, npcData.x, npcData.y));

        // Update viewport for mobile after resize
        updateViewport();
    });
}

preloadSprites().then(async () => {
    // Check URL route first (e.g., /username or /demo)
    const route = parseRoute();
    const { username } = route;

    // Demo mode - skip auth, go straight to demo
    if (route.isDemo) {
        startGame(null);
        return;
    }

    if (isConfigured() && username) {
        // Initialize auth first so we know if the current user is the owner
        await initAuth();

        // Direct link to a user's world - load it (may create map if owner has none)
        const routeResult = await handleRoute();

        if (routeResult && routeResult.mapData) {

            // Convert and start game with the routed map
            const mapData = convertMapDataToGameFormat(routeResult.mapData);
            initializeMapFromData(mapData);

            // Store map metadata for potential editing
            window.currentMapId = routeResult.mapId;
            window.currentMapProfile = routeResult.profile;

            // Use isOwner from route result
            const isOwner = routeResult.isOwner;

            startGameWithMapData(mapData, {
                isOwner,
                isUserWorld: true,
                introText: routeResult.mapData.introText,
                pageTitle: routeResult.mapData.pageTitle
            });

            // If owner, enable the editor
            if (isOwner) {
                setTimeout(() => {
                    if (window.mapEditor) {
                        window.mapEditor.toggleEditor();
                    }
                }, 500);

                // Show appropriate banner based on subscription/trial status
                if (!routeResult.subscriptionActive) {
                    if (routeResult.inTrial) {
                        // Show trial banner with days remaining
                        showTrialBanner(routeResult.trialDaysRemaining);
                    } else {
                        // Trial expired - show subscribe banner
                        showUnpaidOwnerBanner();
                    }
                }
            }
        }
        // If routeResult is null, handleRoute already showed not-found screen
        return;
    }

    if (isConfigured()) {
        // Supabase is configured - show auth screen
        const user = await initAuth();

        async function handleUserReady(user) {
            if (!user) {
                // Guest - play default map
                startGame(null);
                return;
            }

            // Check if user has a map
            const myMaps = await fetchMyMaps();

            if (myMaps.length === 0) {
                // New user - generate starter island
                const starterMap = generateStarterIsland(50, 30);

                // Save it to Supabase
                const savedMap = await saveMapToSupabase(
                    starterMap,
                    'My World',
                    '',
                    true // public by default
                );

                if (savedMap) {
                    window.currentMapId = savedMap.id;
                }

                // Load and enable editor
                const mapData = convertMapDataToGameFormat(starterMap);
                initializeMapFromData(mapData);
                startGameWithMapData(mapData, { isOwner: true, isUserWorld: true });

                // Enable editor after a short delay
                setTimeout(() => {
                    if (window.mapEditor) {
                        window.mapEditor.toggleEditor();
                    }
                }, 500);
            } else {
                // Existing user - load their first map
                const userMap = myMaps[0];
                const mapRecord = await loadMapFromSupabase(userMap.id);
                if (mapRecord) {
                    window.currentMapId = userMap.id;
                    const mapData = convertMapDataToGameFormat(mapRecord);
                    initializeMapFromData(mapData);
                    startGameWithMapData(mapData, {
                        isOwner: true,
                        isUserWorld: true,
                        introText: mapRecord.introText,
                        pageTitle: mapRecord.pageTitle
                    });

                    // Enable editor for owner
                    setTimeout(() => {
                        if (window.mapEditor) {
                            window.mapEditor.toggleEditor();
                        }
                    }, 500);
                } else {
                    startGame(null);
                }
            }
        }

        onAuthChange(handleUserReady);

        if (user) {
            // Already signed in
            handleUserReady(user);
        } else {
            // Show auth screen
            showAuthScreen();
        }
    } else {
        // No Supabase - start game immediately with default map
        startGame(null);
    }
}); 