import { placeStructures } from './structures.js';
import { loadMapData, convertMapDataToGameFormat } from './mapLoader.js';
import { getSpriteUrl } from './spriteCache.js';
import { drawStructures } from './structures.js';

// Map generation and tile helpers
export const tileTypes = {
    WATER: { color: 'blue', passable: false, resource: null },
    DIRT: { color: 'brown', passable: true, resource: null },
    GRASS: { color: 'green', passable: true, resource: null },
    ROCK: { color: 'grey', passable: false, resource: 'stone' },
    FLOWER: { color: 'pink', passable: true, resource: null },
    SMALL_TREE: { color: 'darkgreen', passable: false, resource: 'wood' },
    LARGE_TREE: { color: 'darkgreen', passable: false, resource: 'wood' },
    EGG: { color: 'white', passable: true, resource: 'egg' },
    BADGE: { color: 'gold', passable: true, resource: 'badge' },
    FARMHOUSE: { color: 'white', passable: false, resource: null },
};
export let MAP_WIDTH_TILES = 64;
export let MAP_HEIGHT_TILES = 48;
export let map = [];
export let farmhouse = null; // {x, y, w, h}
export let chickenCoop = { x: 18, y: 15, w: 5, h: 3 }; // {x, y, w, h} in tiles
export let signObj = { x: 29, y: 8, w: 13, h: 7 }; // {x, y, w, h} in tiles

// Resource management
const respawnTimers = new Map(); // Track respawn timers by position

export function setMapSize(width, height) {
    MAP_WIDTH_TILES = width;
    MAP_HEIGHT_TILES = height;
}

export async function initializeMap() {
    // Determine if we should use landscape or portrait map
    const aspectRatio = MAP_WIDTH_TILES / MAP_HEIGHT_TILES;
    const isLandscape = aspectRatio > 1.2;

    // Load map data from JSON
    const mapData = await loadMapData(isLandscape);
    const gameData = convertMapDataToGameFormat(mapData);

    // Update map dimensions
    MAP_WIDTH_TILES = gameData.width;
    MAP_HEIGHT_TILES = gameData.height;

    // Set the map data
    map = gameData.map;

    // Update structure references
    gameData.structures.forEach(structure => {
        switch (structure.type) {
            case 'FARMHOUSE':
                farmhouse = { x: structure.x, y: structure.y, w: structure.width, h: structure.height };
                break;
            case 'CHICKEN_COOP':
                chickenCoop = { x: structure.x, y: structure.y, w: structure.width, h: structure.height };
                break;
            case 'SIGN':
                signObj = { x: structure.x, y: structure.y, w: structure.width, h: structure.height };
                break;
        }
    });

    // Place structures using the existing module
    placeStructures(map, MAP_WIDTH_TILES, MAP_HEIGHT_TILES);

    return gameData;
}

export function getTile(x, y) {
    if (x >= 0 && x < MAP_WIDTH_TILES && y >= 0 && y < MAP_HEIGHT_TILES) {
        const tiles = map[y][x];
        return tiles[tiles.length - 1];
    }
    return null;
}

export function randomGrassOrDirt() {
    while (true) {
        const x = Math.floor(Math.random() * MAP_WIDTH_TILES);
        const y = Math.floor(Math.random() * MAP_HEIGHT_TILES);
        const tiles = map[y][x];
        if (tiles.includes(tileTypes.GRASS) || tiles.includes(tileTypes.DIRT)) {
            return { x, y };
        }
    }
}

export function removeResource(x, y) {
    const tiles = map[y][x];
    const topTile = tiles[tiles.length - 1];

    if (topTile && topTile.resource) {
        // Remove the resource from the map data
        tiles.pop();

        // Schedule respawn
        const respawnTime = 30000 + Math.random() * 30000; // 30-60 seconds
        const timerId = setTimeout(() => {
            respawnResource(x, y, topTile);
            respawnTimers.delete(`${x},${y}`);
        }, respawnTime);

        respawnTimers.set(`${x},${y}`, timerId);

        return topTile; // Return the removed resource for UI updates
    }
    return null;
}

export function respawnResource(x, y, resourceType) {
    const tiles = map[y][x];
    tiles.push(resourceType);
}

export function placeResourceAtPosition(x, y, type) {
    if (x >= 0 && y >= 0 && x < MAP_WIDTH_TILES && y < MAP_HEIGHT_TILES) {
        map[y][x].push(type);
    }
}

export function getResourceAt(x, y) {
    if (x >= 0 && x < MAP_WIDTH_TILES && y >= 0 && y < MAP_HEIGHT_TILES) {
        const tiles = map[y][x];
        const topTile = tiles[tiles.length - 1];
        return topTile && topTile.resource ? topTile : null;
    }
    return null;
}

export function getMapDims() {
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
    } else if (aspectRatio < 0.6) {
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

export function drawMap(svg) {
    svg.innerHTML = '';
    const offsetX = window.MAP_OFFSET_X || 0;
    const offsetY = window.MAP_OFFSET_Y || 0;
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
            imgBase.setAttribute('x', offsetX + x * window.TILE_SIZE);
            imgBase.setAttribute('y', offsetY + y * window.TILE_SIZE);
            imgBase.setAttribute('width', window.TILE_SIZE);
            imgBase.setAttribute('height', window.TILE_SIZE);
            svg.appendChild(imgBase);
        }
    }

    // Draw structures using the new module
    drawStructures(svg, offsetX, offsetY);

    // Draw overlays/resources
    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
            const tiles = map[y][x];
            const top = tiles[tiles.length - 1];
            let overlay = null;
            let resourceType = null;
            if (top === tileTypes.LARGE_TREE || top === tileTypes.SMALL_TREE) {
                overlay = 'tree.png';
                resourceType = 'tree';
            } else if (top === tileTypes.ROCK) {
                overlay = 'stone.png';
                resourceType = 'stone';
            } else if (top === tileTypes.FLOWER) {
                overlay = 'flower.png';
                resourceType = 'flower';
            } else if (top === tileTypes.EGG) {
                overlay = 'egg.png';
                resourceType = 'egg';
            } else if (top === tileTypes.BADGE) {
                overlay = 'badge.png';
                resourceType = 'badge';
            }
            if (overlay) {
                const imgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                imgOverlay.setAttribute('href', getSpriteUrl(overlay));
                imgOverlay.setAttribute('x', offsetX + x * window.TILE_SIZE);
                imgOverlay.setAttribute('y', offsetY + y * window.TILE_SIZE);
                imgOverlay.setAttribute('width', window.TILE_SIZE);
                imgOverlay.setAttribute('height', window.TILE_SIZE);
                imgOverlay.setAttribute('data-resource', resourceType);
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