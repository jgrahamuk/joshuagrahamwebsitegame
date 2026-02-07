import { tileTypes } from './map.js';
import { loadMapById } from './mapBrowser.js';
import { collectablesSystem } from './collectables.js';
import { imageTilesSystem } from './imageTiles.js';
import { textTilesSystem } from './textTiles.js';

let currentMapData = null;
let currentMapId = null; // Supabase map ID if loaded from DB

export function getCurrentMapId() {
    return currentMapId;
}

export function setCurrentMapId(id) {
    currentMapId = id;
}

export async function loadMapData() {
    try {
        const response = await fetch('maps/map.json');
        if (!response.ok) {
            throw new Error(`Failed to load map: ${response.statusText}`);
        }
        currentMapData = await response.json();
        currentMapId = null; // Default map, no DB ID
        return currentMapData;
    } catch (error) {
        console.error('Error loading map data:', error);
        // Fallback to generated map if JSON loading fails
        return generateFallbackMap();
    }
}

export async function loadMapFromSupabase(mapId) {
    try {
        const mapRecord = await loadMapById(mapId);
        if (!mapRecord || !mapRecord.map_data) {
            console.error('Map not found or empty:', mapId);
            return null;
        }
        currentMapData = mapRecord.map_data;
        currentMapId = mapRecord.id;
        return currentMapData;
    } catch (error) {
        console.error('Error loading map from Supabase:', error);
        return null;
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
        chickens: [],
        cockerels: []
    };
}

export function getCurrentMapData() {
    return currentMapData;
}

export function convertMapDataToGameFormat(mapData) {
    const { width, height, tiles, structures, resources, npcs, chickens, cockerels } = mapData;

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
        if (tile.x >= 0 && tile.x < width && tile.y >= 0 && tile.y < height) {
            gameMap[tile.y][tile.x] = tile.layers.map(layerType => {
                switch (layerType) {
                    case 'WATER': return tileTypes.WATER;
                    case 'WATER_BORDER': return { ...tileTypes.WATER, color: '#3bbcff' };
                    case 'GRASS': return tileTypes.GRASS;
                    case 'DIRT': return tileTypes.DIRT;
                    case 'IMAGE': return tileTypes.IMAGE;
                    case 'TEXT': return tileTypes.TEXT;
                    default: return tileTypes.WATER;
                }
            });
        }
    });

    // Apply resources
    resources.forEach(resource => {
        if (resource.x >= 0 && resource.x < width && resource.y >= 0 && resource.y < height &&
            gameMap[resource.y] && gameMap[resource.y][resource.x] && gameMap[resource.y][resource.x].length > 1) {
            switch (resource.type) {
                case 'LARGE_TREE': gameMap[resource.y][resource.x].push(tileTypes.LARGE_TREE); break;
                case 'BUSH': gameMap[resource.y][resource.x].push(tileTypes.BUSH); break;
                case 'PINE_TREE': gameMap[resource.y][resource.x].push(tileTypes.PINE_TREE); break;
                case 'ROCK': gameMap[resource.y][resource.x].push(tileTypes.ROCK); break;
                case 'FLOWER': gameMap[resource.y][resource.x].push(tileTypes.FLOWER); break;
                case 'EGG': gameMap[resource.y][resource.x].push(tileTypes.EGG); break;
                case 'BADGE': gameMap[resource.y][resource.x].push(tileTypes.BADGE); break;
            }
        }
    });

    // Apply structures to the map tiles
    structures.forEach(structure => {
        for (let y = structure.y; y < structure.y + structure.height; y++) {
            for (let x = structure.x; x < structure.x + structure.width; x++) {
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    // Make sure we have a valid base tile first
                    if (!gameMap[y][x].some(tile => tile === tileTypes.GRASS || tile === tileTypes.DIRT)) {
                        gameMap[y][x].push(tileTypes.GRASS);
                    }
                    // Add the structure tile
                    gameMap[y][x].push({ color: 'white', passable: false, resource: null });
                }
            }
        }
    });

    // Load collectables into the system
    if (mapData.collectables) {
        collectablesSystem.loadFromMapData(mapData.collectables);
    } else {
        collectablesSystem.loadFromMapData([]);
    }

    // Load image tiles into the system
    if (mapData.imageTiles) {
        imageTilesSystem.loadFromMapData(mapData.imageTiles);
    } else {
        imageTilesSystem.loadFromMapData([]);
    }

    // Load text tiles into the system
    if (mapData.textTiles) {
        textTilesSystem.loadFromMapData(mapData.textTiles);
    } else {
        textTilesSystem.loadFromMapData([]);
    }

    return {
        map: gameMap,
        structures,
        npcs: npcs || [],
        chickens: chickens || [],
        cockerels: cockerels || [],
        width: width || 60,
        height: height || 34,
        introText: mapData.introText || null,
        pageTitle: mapData.pageTitle || null,
        collectables: mapData.collectables || [],
        imageTiles: mapData.imageTiles || [],
        textTiles: mapData.textTiles || []
    };
}

export function saveMap() {
    const mapData = {
        map: map,
        chickens: window.chickens.map(chicken => ({ x: chicken.x, y: chicken.y })),
        cockerels: window.cockerels.map(cockerel => ({ x: cockerel.x, y: cockerel.y })),
        npcs: window.npcs.map(npc => ({
            name: npc.name,
            message: npc.message,
            x: npc.x,
            y: npc.y
        }))
    };

    // Save to local storage
    localStorage.setItem('map', JSON.stringify(mapData));

    // Save to file
    const blob = new Blob([JSON.stringify(mapData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'map.json';
    a.click();
    URL.revokeObjectURL(url);
}
