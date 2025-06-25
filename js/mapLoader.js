import { tileTypes } from './map.js';

let currentMapData = null;

export async function loadMapData(isLandscape) {
    const mapFile = 'maps/map.json';

    try {
        const response = await fetch(mapFile);
        if (!response.ok) {
            throw new Error(`Failed to load map: ${response.statusText}`);
        }
        currentMapData = await response.json();
        return currentMapData;
    } catch (error) {
        console.error('Error loading map data:', error);
        // Fallback to generated map if JSON loading fails
        return generateFallbackMap();
    }
}

function generateFallbackMap() {
    // Simple fallback map generation
    const width = 60;
    const height = 34;

    return {
        width,
        height,
        tiles: [],
        structures: [],
        resources: [],
        npcs: [],
        chickens: []
    };
}

export function getCurrentMapData() {
    return currentMapData;
}

export function convertMapDataToGameFormat(mapData) {
    const { width, height, tiles, structures, resources, npcs, chickens } = mapData;

    // Convert tile data to game format
    const gameMap = [];
    for (let y = 0; y < height; y++) {
        gameMap[y] = [];
        for (let x = 0; x < width; x++) {
            gameMap[y][x] = [tileTypes.WATER]; // Default water
        }
    }

    // Apply tile layers
    tiles.forEach(tile => {
        const { x, y, layers } = tile;
        if (x >= 0 && x < width && y >= 0 && y < height) {
            gameMap[y][x] = layers.map(layerType => {
                switch (layerType) {
                    case 'WATER': return tileTypes.WATER;
                    case 'WATER_BORDER': return { ...tileTypes.WATER, color: '#3bbcff' };
                    case 'GRASS': return tileTypes.GRASS;
                    case 'DIRT': return tileTypes.DIRT;
                    default: return tileTypes.WATER;
                }
            });
        }
    });

    // Apply resources
    resources.forEach(resource => {
        const { x, y, type } = resource;
        if (x >= 0 && x < width && y >= 0 && y < height && gameMap[y] && gameMap[y][x] && gameMap[y][x].length > 1) {
            switch (type) {
                case 'LARGE_TREE': gameMap[y][x].push(tileTypes.LARGE_TREE); break;
                case 'SMALL_TREE': gameMap[y][x].push(tileTypes.SMALL_TREE); break;
                case 'ROCK': gameMap[y][x].push(tileTypes.ROCK); break;
                case 'FLOWER': gameMap[y][x].push(tileTypes.FLOWER); break;
                case 'EGG': gameMap[y][x].push(tileTypes.EGG); break;
                case 'BADGE': gameMap[y][x].push(tileTypes.BADGE); break;
            }
        }
    });

    return {
        map: gameMap,
        structures,  // No transformation needed
        npcs,        // No transformation needed
        chickens,    // No transformation needed
        width,
        height
    };
} 