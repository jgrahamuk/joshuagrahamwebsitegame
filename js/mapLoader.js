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
        chickens: [],
        cockerels: []
    };
}

export function getCurrentMapData() {
    return currentMapData;
}

export function convertMapDataToGameFormat(mapData, isLandscape) {
    const { width, height, tiles, structures, resources, npcs, chickens, cockerels } = mapData;

    // For portrait mode, swap width and height
    const finalWidth = isLandscape ? width : height;
    const finalHeight = isLandscape ? height : width;

    // Convert tile data to game format
    const gameMap = [];
    for (let y = 0; y < finalHeight; y++) {
        gameMap[y] = [];
        for (let x = 0; x < finalWidth; x++) {
            gameMap[y][x] = [tileTypes.WATER]; // Default water
        }
    }

    // Apply tile layers with transposition for portrait mode
    tiles.forEach(tile => {
        let finalX, finalY;
        if (isLandscape) {
            finalX = tile.x;
            finalY = tile.y;
        } else {
            // For portrait mode, rotate 90 degrees clockwise:
            // new_x = old_y
            // new_y = width - 1 - old_x
            finalX = tile.y;
            finalY = width - 1 - tile.x;
        }

        if (finalX >= 0 && finalX < finalWidth && finalY >= 0 && finalY < finalHeight) {
            gameMap[finalY][finalX] = tile.layers.map(layerType => {
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

    // Apply resources with transposition
    resources.forEach(resource => {
        let finalX, finalY;
        if (isLandscape) {
            finalX = resource.x;
            finalY = resource.y;
        } else {
            // For portrait mode, rotate 90 degrees clockwise:
            finalX = resource.y;
            finalY = width - 1 - resource.x;
        }

        if (finalX >= 0 && finalX < finalWidth && finalY >= 0 && finalY < finalHeight &&
            gameMap[finalY] && gameMap[finalY][finalX] && gameMap[finalY][finalX].length > 1) {
            switch (resource.type) {
                case 'LARGE_TREE': gameMap[finalY][finalX].push(tileTypes.LARGE_TREE); break;
                case 'SMALL_TREE': gameMap[finalY][finalX].push(tileTypes.SMALL_TREE); break;
                case 'ROCK': gameMap[finalY][finalX].push(tileTypes.ROCK); break;
                case 'FLOWER': gameMap[finalY][finalX].push(tileTypes.FLOWER); break;
            }
        }
    });

    // Transform structures with transposition and size swapping
    const transformedStructures = structures.map(structure => {
        let finalX, finalY, finalWidth, finalHeight;

        if (isLandscape) {
            finalX = structure.x;
            finalY = structure.y;
            finalWidth = structure.width;
            finalHeight = structure.height;
        } else {
            finalX = structure.y - 1;
            finalY = width - structure.x - structure.width;
            finalWidth = structure.width;
            finalHeight = structure.height;

        }

        return {
            ...structure,
            x: finalX,
            y: finalY,
            width: finalWidth,
            height: finalHeight
        };
    });

    // Transform NPCs with transposition
    const transformedNpcs = npcs.map(npc => {
        let finalX, finalY;
        if (isLandscape) {
            finalX = npc.x;
            finalY = npc.y;
        } else {
            finalX = npc.y;
            finalY = width - 1 - npc.x;
        }

        return {
            ...npc,
            x: finalX,
            y: finalY
        };
    });

    // Transform chickens with transposition
    const transformedChickens = chickens.map(chicken => {
        let finalX, finalY;
        if (isLandscape) {
            finalX = chicken.x;
            finalY = chicken.y;
        } else {
            finalX = chicken.y;
            finalY = width - 1 - chicken.x;
        }

        return {
            x: finalX,
            y: finalY
        };
    });

    // Transform cockerels with transposition
    const transformedCockerels = cockerels ? cockerels.map(cockerel => {
        let finalX, finalY;
        if (isLandscape) {
            finalX = cockerel.x;
            finalY = cockerel.y;
        } else {
            finalX = cockerel.y;
            finalY = width - 1 - cockerel.x;
        }

        return {
            x: finalX,
            y: finalY
        };
    }) : [];

    return {
        map: gameMap,
        structures: transformedStructures,
        npcs: transformedNpcs,
        chickens: transformedChickens,
        cockerels: transformedCockerels,
        width: finalWidth,
        height: finalHeight
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