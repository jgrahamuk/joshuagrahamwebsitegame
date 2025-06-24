import { placeStructures } from './structures.js';
import { loadMapData, convertMapDataToGameFormat } from './mapLoader.js';

// Map generation and tile helpers
export const tileTypes = {
    WATER: { color: 'blue', passable: false, resource: null },
    DIRT: { color: 'brown', passable: true, resource: null },
    GRASS: { color: 'green', passable: true, resource: null },
    ROCK: { color: 'grey', passable: false, resource: 'stone' },
    FLOWER: { color: 'pink', passable: true, resource: null },
    SMALL_TREE: { color: 'darkgreen', passable: false, resource: 'wood' },
    LARGE_TREE: { color: 'darkgreen', passable: false, resource: 'wood' },
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
    if (x >= 0 && y >= 0 && x < MAP_WIDTH_TILES && y < MAP_HEIGHT_TILES && map[y][x].length > 1) {
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