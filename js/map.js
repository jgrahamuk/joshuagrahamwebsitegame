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
    BUSH: { color: 'darkgreen', passable: false, resource: 'wood' },
    PINE_TREE: { color: 'darkgreen', passable: false, resource: 'wood' },
    LARGE_TREE: { color: 'darkgreen', passable: false, resource: 'wood' },
    EGG: { color: 'white', passable: true, resource: 'egg' },
    BADGE: { color: 'gold', passable: true, resource: 'badge' },
    FARMHOUSE: { color: 'white', passable: false, resource: null },
};
export let MAP_WIDTH_TILES = 60;
export let MAP_HEIGHT_TILES = 34;
export let map = [];
export let farmhouse = null; // {x, y, w, h}
export let chickenCoop = null; // {x, y, w, h} in tiles
export let signObj = null; // {x, y, w, h} in tiles

// Resource management
const respawnTimers = new Map(); // Track respawn timers by position

export function setMapSize(width, height) {
    MAP_WIDTH_TILES = width;
    MAP_HEIGHT_TILES = height;
}

export async function initializeMap(forcePortrait = false) {
    // Determine if we should use landscape or portrait orientation
    const aspectRatio = window.innerWidth / window.innerHeight;
    const isLandscape = aspectRatio > 1 && !forcePortrait;

    // Load map data from JSON
    const mapData = await loadMapData(isLandscape);
    const gameData = convertMapDataToGameFormat(mapData);

    // Update map dimensions
    MAP_WIDTH_TILES = gameData.width;
    MAP_HEIGHT_TILES = gameData.height;

    // Set the map data
    map = gameData.map;

    // Reset structure references
    farmhouse = null;
    chickenCoop = null;
    signObj = null;
    window.farmhouse = null;
    window.chickenCoop = null;
    window.signObj = null;

    // Update structure references
    if (gameData.structures) {
        gameData.structures.forEach(structure => {
            const structureObj = {
                x: structure.x,
                y: structure.y,
                w: structure.width,
                h: structure.height
            };

            switch (structure.type) {
                case 'FARMHOUSE':
                    farmhouse = structureObj;
                    window.farmhouse = farmhouse;
                    break;
                case 'CHICKEN_COOP':
                    chickenCoop = structureObj;
                    window.chickenCoop = chickenCoop;
                    break;
                case 'SIGN':
                    signObj = structureObj;
                    window.signObj = signObj;
                    break;
            }
        });
    }

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
    // Validate coordinates are within map bounds
    if (x < 0 || x >= MAP_WIDTH_TILES || y < 0 || y >= MAP_HEIGHT_TILES) {
        return null;
    }

    // Validate map and tiles exist
    if (!map || !map[y] || !map[y][x]) {
        return null;
    }

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

export function drawMap(svg) {
    svg.innerHTML = '';
    const svgWidth = window.innerWidth;
    const svgHeight = window.innerHeight;

    // Calculate the tile size that would fit the map in both dimensions
    const horizontalTileSize = svgWidth / MAP_WIDTH_TILES;
    const verticalTileSize = svgHeight / MAP_HEIGHT_TILES;

    // Use the smaller tile size to ensure the map fits in both dimensions
    window.TILE_SIZE = Math.min(horizontalTileSize, verticalTileSize);
    const tileSize = window.TILE_SIZE;

    // Calculate the total map dimensions
    const totalMapWidth = MAP_WIDTH_TILES * tileSize;
    const totalMapHeight = MAP_HEIGHT_TILES * tileSize;

    // Center the map
    window.MAP_OFFSET_X = Math.max(0, (svgWidth - totalMapWidth) / 2);
    window.MAP_OFFSET_Y = Math.max(0, (svgHeight - totalMapHeight) / 2);
    const offsetX = window.MAP_OFFSET_X;
    const offsetY = window.MAP_OFFSET_Y;

    // Fill the entire SVG area with water tiles (no gaps)
    const numXTiles = Math.ceil(svgWidth / tileSize);
    const numYTiles = Math.ceil(svgHeight / tileSize);
    for (let y = 0; y < numYTiles; y++) {
        for (let x = 0; x < numXTiles; x++) {
            const imgWater = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imgWater.setAttribute('href', getSpriteUrl('tile-water.gif'));
            imgWater.setAttribute('x', x * tileSize);
            imgWater.setAttribute('y', y * tileSize);
            imgWater.setAttribute('width', tileSize);
            imgWater.setAttribute('height', tileSize);
            imgWater.style.imageRendering = 'pixelated';
            svg.appendChild(imgWater);
        }
    }

    // Draw the map tiles
    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
            const tiles = map[y][x];
            let baseTile = tiles.find(t => t === tileTypes.DIRT) ? 'tile-dirt.gif'
                : tiles.find(t => t === tileTypes.GRASS) ? 'tile-grass.gif'
                    : tiles.find(t => t === tileTypes.WATER || (t.color && t.color === '#3bbcff')) ? 'tile-water.gif'
                        : 'tile-grass.gif';
            let basePath = getSpriteUrl(baseTile);
            const imgBase = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imgBase.setAttribute('href', basePath);
            imgBase.setAttribute('x', offsetX + x * tileSize);
            imgBase.setAttribute('y', offsetY + y * tileSize);
            imgBase.setAttribute('width', tileSize);
            imgBase.setAttribute('height', tileSize);
            imgBase.style.imageRendering = 'pixelated';
            imgBase.style.zIndex = '1';
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
            let scale = 1;

            if (top === tileTypes.LARGE_TREE) {
                overlay = 'tree.gif';
                resourceType = 'tree';
                scale = 2;
            } else if (top === tileTypes.BUSH) {
                overlay = 'bush.gif';
                resourceType = 'tree';
            } else if (top === tileTypes.PINE_TREE) {
                overlay = 'pine-tree.gif';
                resourceType = 'tree';
                scale = 2;
            } else if (top === tileTypes.ROCK) {
                overlay = 'stone.gif';
                resourceType = 'stone';
            } else if (top === tileTypes.FLOWER) {
                overlay = 'flower.gif';
                resourceType = 'flower';
            } else if (top === tileTypes.EGG) {
                overlay = 'egg.gif';
                resourceType = 'egg';
            } else if (top === tileTypes.BADGE) {
                overlay = 'badge.gif';
                resourceType = 'badge';
            }

            if (overlay) {
                const imgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                imgOverlay.setAttribute('href', getSpriteUrl(overlay));

                // For scaled resources, adjust position to keep centered
                if (scale > 1) {
                    const offset = (window.TILE_SIZE * (scale - 1)) / 2;
                    imgOverlay.setAttribute('x', offsetX + x * window.TILE_SIZE - offset);
                    imgOverlay.setAttribute('y', offsetY + y * window.TILE_SIZE - offset);
                    imgOverlay.setAttribute('width', window.TILE_SIZE * scale);
                    imgOverlay.setAttribute('height', window.TILE_SIZE * scale);
                } else {
                    imgOverlay.setAttribute('x', offsetX + x * window.TILE_SIZE);
                    imgOverlay.setAttribute('y', offsetY + y * window.TILE_SIZE);
                    imgOverlay.setAttribute('width', window.TILE_SIZE);
                    imgOverlay.setAttribute('height', window.TILE_SIZE);
                }

                imgOverlay.setAttribute('data-resource', resourceType);
                imgOverlay.style.imageRendering = 'pixelated';
                imgOverlay.style.zIndex = '2';
                svg.appendChild(imgOverlay);
            }
        }
    }

    // If map editor is active, draw grid and border
    if (window.mapEditor && window.mapEditor.isActive) {
        // Create a group for editor overlay elements
        const editorGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        editorGroup.setAttribute('pointer-events', 'none');
        editorGroup.style.zIndex = '3';

        // Draw border around actual map area
        const border = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        border.setAttribute('x', offsetX);
        border.setAttribute('y', offsetY);
        border.setAttribute('width', MAP_WIDTH_TILES * tileSize);
        border.setAttribute('height', MAP_HEIGHT_TILES * tileSize);
        border.setAttribute('fill', 'none');
        border.setAttribute('stroke', '#ff4444');
        border.setAttribute('stroke-width', '2');
        editorGroup.appendChild(border);

        // Draw vertical grid lines
        for (let x = 0; x <= MAP_WIDTH_TILES; x++) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', offsetX + x * tileSize);
            line.setAttribute('y1', offsetY);
            line.setAttribute('x2', offsetX + x * tileSize);
            line.setAttribute('y2', offsetY + MAP_HEIGHT_TILES * tileSize);
            line.setAttribute('stroke', 'rgba(255, 255, 255, 0.2)');
            line.setAttribute('stroke-width', '1');
            editorGroup.appendChild(line);
        }

        // Draw horizontal grid lines
        for (let y = 0; y <= MAP_HEIGHT_TILES; y++) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', offsetX);
            line.setAttribute('y1', offsetY + y * tileSize);
            line.setAttribute('x2', offsetX + MAP_WIDTH_TILES * tileSize);
            line.setAttribute('y2', offsetY + y * tileSize);
            line.setAttribute('stroke', 'rgba(255, 255, 255, 0.2)');
            line.setAttribute('stroke-width', '1');
            editorGroup.appendChild(line);
        }

        svg.appendChild(editorGroup);
    }

    // Create a group for dynamic elements (player, NPCs, chickens)
    const dynamicGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    dynamicGroup.setAttribute('id', 'dynamic-elements');
    dynamicGroup.style.zIndex = '4';
    svg.appendChild(dynamicGroup);

    // Redraw player and NPCs on top
    if (window.player) {
        if (window.player.element.parentNode) {
            window.player.element.parentNode.removeChild(window.player.element);
        }
        dynamicGroup.appendChild(window.player.element);
        window.player.updatePosition();
    }
    if (window.npcs) {
        window.npcs.forEach(npc => {
            if (npc.element.parentNode) {
                npc.element.parentNode.removeChild(npc.element);
            }
            dynamicGroup.appendChild(npc.element);
            npc.updatePosition();
        });
    }
    if (window.chickens) {
        window.chickens.forEach(chicken => {
            if (chicken.element.parentNode) {
                chicken.element.parentNode.removeChild(chicken.element);
            }
            dynamicGroup.appendChild(chicken.element);
            chicken.updatePosition();
        });
    }

    // Ensure SVG uses proper stacking context
    svg.style.isolation = 'isolate';
} 