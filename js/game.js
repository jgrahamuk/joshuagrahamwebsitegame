import { initializeMap, getTile, randomGrassOrDirt, tileTypes, map, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, setMapSize, drawMap } from './map.js';
import { findPath, moveToTarget } from './movement.js';
import { Player } from './player.js';
import { Chicken } from './chickens.js';
import { NPC, npcDefinitions } from './npcs.js';
import { preloadSprites, getSpriteUrl } from './spriteCache.js';
import { drawStructures } from './structures.js';
import { MapEditor } from './mapEditor.js';
import { HelpOverlay } from './helpOverlay.js';
import { badgeSystem } from './badgeSystem.js';

window.TILE_SIZE = 40;
window.MAP_OFFSET_X = 0;
window.MAP_OFFSET_Y = 0;

const gameContainer = document.getElementById('game-container');
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
gameContainer.appendChild(svg);

// Make SVG globally accessible
window.svg = svg;

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

preloadSprites().then(async () => {
    updateTileSize();
    window.addEventListener('resize', async () => {
        updateTileSize();
        await initializeMap();
        drawMap(svg);
        player.updatePosition();
        chickens.forEach(c => c.updatePosition());
        npcs.forEach(n => n.updatePosition());
    });

    // Initialize map and get loaded data
    const mapData = await initializeMap();
    drawMap(svg);

    // Update global map reference to point to the current map data
    window.map = map;

    // Find a valid player start
    let start = randomGrassOrDirt();
    window.player = new Player(svg, start.x, start.y);

    // Create chickens from loaded data
    window.chickens = [];
    mapData.chickens.forEach(chickenData => {
        const chicken = new Chicken(svg, chickenData.x, chickenData.y);
        window.chickens.push(chicken);
    });

    // Create NPCs from loaded data
    window.npcs = mapData.npcs.map(npcData => new NPC(svg, npcData.name, npcData.message, npcData.x, npcData.y));

    // Initialize map editor (hidden by default)
    window.mapEditor = new MapEditor(svg, gameContainer);

    // Initialize help overlay
    window.helpOverlay = new HelpOverlay();

    // Initialize badge system
    badgeSystem.initialize();

    // Main animation loop
    setInterval(() => {
        const now = Date.now();
        window.chickens.forEach(c => c.tick(now));
        window.npcs.forEach(n => n.tick(now));
    }, 50);

    // Player movement and interaction
    svg.addEventListener('click', (e) => {
        const rect = svg.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / window.TILE_SIZE);
        const y = Math.floor((e.clientY - rect.top) / window.TILE_SIZE);

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
}); 