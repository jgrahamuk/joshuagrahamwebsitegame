import { initializeMap, getTile, randomGrassOrDirt, tileTypes, map, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, setMapSize, drawMap } from './map.js';
import { findPath, moveToTarget } from './movement.js';
import { Player } from './player.js';
import { Chicken, Cockerel } from './chickens.js';
import { NPC, npcDefinitions } from './npcs.js';
import { preloadSprites, getSpriteUrl } from './spriteCache.js';
import { drawStructures } from './structures.js';
import { MapEditor } from './mapEditor.js';
import { HelpOverlay } from './helpOverlay.js';
import { badgeSystem } from './badgeSystem.js';

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

        // Position arrow above the target, centered
        const targetCenterX = (window.MAP_OFFSET_X || 0) + (pos.x * window.TILE_SIZE) + (window.TILE_SIZE / 2);
        const arrowX = targetCenterX - (window.TILE_SIZE / 2);
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

function updateTileSize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Always use the width to determine tile size
    const tileSizeX = w / MAP_WIDTH_TILES;
    window.TILE_SIZE = tileSizeX;

    // Set SVG size to fill the entire screen
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);

    // Calculate map pixel dimensions
    const mapPixelWidth = MAP_WIDTH_TILES * window.TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT_TILES * window.TILE_SIZE;

    // Center the map vertically
    window.MAP_OFFSET_X = 0;
    window.MAP_OFFSET_Y = Math.max(0, (window.innerHeight - mapPixelHeight) / 2);

    // Reset positioning since we're filling the screen
    svg.style.position = 'static';
    svg.style.left = '';
    svg.style.top = '';
}

// Make drawMap globally accessible
window.drawMap = drawMap;

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

preloadSprites().then(async () => {
    // Initialize map and get loaded data
    const mapData = await initializeMap();
    updateTileSize();
    drawMap(svg);

    // Update global map reference to point to the current map data
    window.map = map;

    // Create a group for all game entities
    const gameEntitiesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gameEntitiesGroup.setAttribute('id', 'game-entities');
    svg.appendChild(gameEntitiesGroup);

    // Find a valid player start
    let start = randomGrassOrDirt();
    window.player = new Player(svg, start.x, start.y);

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

    // Initialize help overlay
    window.helpOverlay = new HelpOverlay();

    // Initialize badge system
    badgeSystem.initialize();

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

    // Start the game loop
    requestAnimationFrame(gameLoop);

    // Player movement and interaction
    svg.addEventListener('click', (e) => {
        // If player is in intro sequence, ignore map clicks
        if (window.player.isInIntro) return;

        const rect = svg.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left - (window.MAP_OFFSET_X || 0)) / window.TILE_SIZE);
        const y = Math.floor((e.clientY - rect.top - (window.MAP_OFFSET_Y || 0)) / window.TILE_SIZE);

        if (x >= 0 && x < MAP_WIDTH_TILES && y >= 0 && y < MAP_HEIGHT_TILES) {
            // Check if clicking on an NPC or surrounding tiles
            const clickedNPC = window.npcs.find(npc => npc.isClicked(x, y));
            if (clickedNPC && clickedNPC.isNearPlayer(window.player.x, window.player.y)) {
                // Already adjacent - show message immediately
                window.npcs.filter(npc => npc !== clickedNPC).forEach(npc => npc.hideMessage());
                clickedNPC.showMessage();
                return;
            }

            // Check if clicking on a resource
            const tile = getTile(x, y);
            if (tile && tile.resource) {
                moveToTarget(x, y, window.player, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, 'resource');
                return;
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
    });

    window.addEventListener('resize', async () => {
        const mapData = await initializeMap();
        updateTileSize();
        drawMap(svg);

        // Re-create player at last known position (default to 0,0 if not available)
        let start = { x: window.player?.x || 0, y: window.player?.y || 0 };
        window.player = new Player(svg, start.x, start.y);

        // Re-create chickens
        window.chickens = [];
        mapData.chickens.forEach(chickenData => {
            const chicken = new Chicken(svg, chickenData.x, chickenData.y);
            window.chickens.push(chicken);
        });

        // Re-create cockerels
        window.cockerels = [];
        if (mapData.cockerels) {
            mapData.cockerels.forEach(cockerelData => {
                const cockerel = new Cockerel(svg, cockerelData.x, cockerelData.y);
                window.cockerels.push(cockerel);
            });
        }

        // Re-create NPCs
        window.npcs = mapData.npcs.map(npcData => new NPC(svg, npcData.name, npcData.message, npcData.x, npcData.y));
    });
}); 