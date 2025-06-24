import { initializeMap, getTile, randomGrassOrDirt, tileTypes, map, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, setMapSize } from './map.js';
import { findPath, moveToTarget } from './movement.js';
import { Player } from './player.js';
import { Chicken } from './chickens.js';
import { NPC, npcDefinitions } from './npcs.js';
import { preloadSprites, getSpriteUrl } from './spriteCache.js';
import { drawStructures } from './structures.js';

window.TILE_SIZE = 40;

const gameContainer = document.getElementById('game-container');
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
gameContainer.appendChild(svg);

function updateTileSize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Calculate tile size to fill the entire screen
    const tileSizeX = w / MAP_WIDTH_TILES;
    const tileSizeY = h / MAP_HEIGHT_TILES;

    // Use the larger tile size to ensure the map fills the screen
    window.TILE_SIZE = Math.max(tileSizeX, tileSizeY);

    // Set SVG size to fill the entire screen
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);

    // Reset positioning since we're filling the screen
    svg.style.position = 'static';
    svg.style.left = '';
    svg.style.top = '';
}

function drawMap() {
    svg.innerHTML = '';
    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
            const tiles = map[y][x];
            let baseTile = tiles.find(t => t === tileTypes.DIRT) ? 'tile-dirt.png'
                : tiles.find(t => t === tileTypes.GRASS) ? 'tile-grass.png'
                    : tiles.find(t => t === tileTypes.WATER || (t.color && t.color === '#3bbcff')) ? 'tile-water.png'
                        : 'tile-grass.png';
            let basePath = getSpriteUrl(baseTile);
            const imgBase = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imgBase.setAttribute('href', basePath);
            imgBase.setAttribute('x', x * window.TILE_SIZE);
            imgBase.setAttribute('y', y * window.TILE_SIZE);
            imgBase.setAttribute('width', window.TILE_SIZE);
            imgBase.setAttribute('height', window.TILE_SIZE);
            svg.appendChild(imgBase);
        }
    }

    // Draw structures using the new module
    drawStructures(svg);

    // Draw overlays/resources
    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
            const tiles = map[y][x];
            const top = tiles[tiles.length - 1];
            let overlay = null;
            if (top === tileTypes.LARGE_TREE || top === tileTypes.SMALL_TREE) {
                overlay = 'tree.png';
            } else if (top === tileTypes.ROCK) {
                overlay = 'stone.png';
            } else if (top === tileTypes.FLOWER) {
                overlay = 'flower.png';
            }
            if (overlay) {
                const imgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                imgOverlay.setAttribute('href', getSpriteUrl(overlay));
                imgOverlay.setAttribute('x', x * window.TILE_SIZE);
                imgOverlay.setAttribute('y', y * window.TILE_SIZE);
                imgOverlay.setAttribute('width', window.TILE_SIZE);
                imgOverlay.setAttribute('height', window.TILE_SIZE);
                svg.appendChild(imgOverlay);
            }
        }
    }

    // Redraw player and NPCs on top
    if (window.player) {
        window.player.updatePosition();
    }
    if (window.npcs) {
        window.npcs.forEach(npc => npc.updatePosition());
    }
    if (window.chickens) {
        window.chickens.forEach(chicken => chicken.updatePosition());
    }
}

// Make drawMap globally accessible
window.drawMap = drawMap;

function getMapDims() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspectRatio = w / h;

    // Calculate base tile count based on screen size
    let baseTiles;
    if (w < 700) {
        // Mobile devices - use fewer tiles for better performance
        baseTiles = 24;
    } else if (w < 1200) {
        // Medium screens
        baseTiles = 36;
    } else {
        // Large screens
        baseTiles = 48;
    }

    if (aspectRatio > 1.5) {
        // Very wide landscape - make map wider to fill horizontal space
        return { width: Math.floor(baseTiles * 1.8), height: baseTiles };
    } else if (aspectRatio > 1.2) {
        // Landscape - make map wider
        return { width: Math.floor(baseTiles * 1.5), height: baseTiles };
    } else if (aspectRatio < 0.7) {
        // Very tall portrait - make map taller to fill vertical space
        return { width: baseTiles, height: Math.floor(baseTiles * 1.8) };
    } else if (aspectRatio < 0.9) {
        // Portrait - make map taller
        return { width: baseTiles, height: Math.floor(baseTiles * 1.5) };
    } else {
        // Square-ish - balanced dimensions
        return { width: baseTiles, height: baseTiles };
    }
}

preloadSprites().then(async () => {
    const dims = getMapDims();
    setMapSize(dims.width, dims.height);
    updateTileSize();
    window.addEventListener('resize', async () => {
        const dims = getMapDims();
        setMapSize(dims.width, dims.height);
        updateTileSize();
        await initializeMap();
        drawMap();
        player.updatePosition();
        chickens.forEach(c => c.updatePosition());
        npcs.forEach(n => n.updatePosition());
    });

    // Initialize map and get loaded data
    const mapData = await initializeMap();
    drawMap();

    // Find a valid player start
    let start = randomGrassOrDirt();
    window.player = new Player(svg, start.x, start.y);

    // Create chickens from loaded data
    window.chickens = [];
    mapData.chickens.forEach(chickenData => {
        const chicken = new Chicken(svg);
        chicken.x = chickenData.x;
        chicken.y = chickenData.y;
        chicken.updatePosition();
        window.chickens.push(chicken);
    });

    // Create NPCs from loaded data
    window.npcs = mapData.npcs.map(npcData => new NPC(svg, npcData.name, npcData.message, npcData.x, npcData.y));

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