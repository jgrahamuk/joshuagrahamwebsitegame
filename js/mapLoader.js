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
    // Simple fallback map generation with 16:9 aspect ratio
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

export function convertMapDataToGameFormat(mapData, isLandscape) {
    const { width, height, tiles, structures, resources, npcs, chickens } = mapData;

    // Determine if we need to transpose the map for portrait mode
    const shouldTranspose = !isLandscape;

    // For landscape, use map width/height; for portrait, transpose
    let finalWidth = isLandscape ? width : height;
    let finalHeight = isLandscape ? height : width;
    F
    // Convert tile data to game format
    const gameMap = [];
    for (let y = 0; y < finalHeight; y++) {
        gameMap[y] = [];
        for (let x = 0; x < finalWidth; x++) {
            gameMap[y][x] = [tileTypes.WATER]; // Default water
        }
    }

    // Apply tile layers with transposition if needed
    tiles.forEach(tile => {
        let { x, y } = tile;
        const { layers } = tile;
        if (shouldTranspose) {
            [x, y] = [y, x];
        }
        if (x >= 0 && x < finalWidth && y >= 0 && y < finalHeight) {
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

    // Apply resources with transposition if needed
    resources.forEach(resource => {
        let { x, y, type } = resource;
        if (shouldTranspose) {
            [x, y] = [y, x];
        }
        if (x >= 0 && x < finalWidth && y >= 0 && y < finalHeight && gameMap[y] && gameMap[y][x] && gameMap[y][x].length > 1) {
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

    // Transform structures with transposition if needed
    const transformedStructures = structures.map(structure => {
        let { x, y, width, height } = structure;
        if (shouldTranspose) {
            [x, y] = [y, x];
            [width, height] = [height, width];
        }
        return { ...structure, x, y, width, height };
    });

    // Transform NPCs with transposition if needed
    const transformedNpcs = npcs.map(npc => {
        let { x, y } = npc;
        if (shouldTranspose) {
            [x, y] = [y, x];
        }
        return { ...npc, x, y };
    });

    // Transform chickens with transposition if needed
    const transformedChickens = chickens.map(chicken => {
        let { x, y } = chicken;
        if (shouldTranspose) {
            [x, y] = [y, x];
        }
        return { x, y };
    });

    return {
        map: gameMap,
        structures: transformedStructures,
        npcs: transformedNpcs,
        chickens: transformedChickens,
        width: finalWidth,
        height: finalHeight
    };
} 