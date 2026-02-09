import { placeStructures } from './structures.js';
import { loadMapData, convertMapDataToGameFormat } from './mapLoader.js';
import { getSpriteUrl, getSpriteCanvas } from './spriteCache.js';
import { drawStructures } from './structures.js';
import { imageTilesSystem } from './imageTiles.js';
import { textTilesSystem } from './textTiles.js';
import { getGrassTileCanvas } from './grassGenerator.js';
import { getDirtTileCanvas } from './dirtGenerator.js';

// Offscreen canvas state for pre-rendered terrain
let mapCanvas = null;
let mapCtx = null;
let mapBlobUrl = null;
let mapImageEl = null;

// Sanitize HTML for text tiles - strip dangerous content, allow only safe tags/attributes
function _sanitizeHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;

    // Remove script tags
    div.querySelectorAll('script').forEach(el => el.remove());

    // Allowed tags and attributes
    const allowedTags = new Set(['b', 'i', 'u', 'span', 'div', 'br', 'font', 'p', 'strong', 'em']);
    const allowedAttrs = new Set(['style', 'color', 'size', 'face']);

    function cleanNode(node) {
        const children = Array.from(node.childNodes);
        for (const child of children) {
            if (child.nodeType === 1) { // Element
                const tag = child.tagName.toLowerCase();
                if (!allowedTags.has(tag)) {
                    // Replace with its children
                    while (child.firstChild) {
                        node.insertBefore(child.firstChild, child);
                    }
                    node.removeChild(child);
                } else {
                    // Remove disallowed attributes
                    const attrs = Array.from(child.attributes);
                    for (const attr of attrs) {
                        if (!allowedAttrs.has(attr.name) || attr.name.startsWith('on')) {
                            child.removeAttribute(attr.name);
                        }
                    }
                    // Strip event handlers from style attribute
                    if (child.hasAttribute('style')) {
                        const style = child.getAttribute('style');
                        // Remove any url() or expression() from style
                        const cleaned = style.replace(/url\s*\([^)]*\)/gi, '').replace(/expression\s*\([^)]*\)/gi, '');
                        child.setAttribute('style', cleaned);
                    }
                    cleanNode(child);
                }
            }
        }
    }

    cleanNode(div);
    return div.innerHTML;
}

// Map generation and tile helpers
export const tileTypes = {
    WATER: { color: 'blue', passable: false, resource: null },
    DIRT: { color: 'brown', passable: true, resource: null },
    GRASS: { color: 'green', passable: true, resource: null },
    ROCK: { color: 'grey', passable: true, resource: 'stone' },
    FLOWER: { color: 'pink', passable: true, resource: null },
    FLOWER_ROSE: { color: 'red', passable: true, resource: null },
    FLOWER_FORGETMENOT: { color: 'lightblue', passable: true, resource: null },
    FLOWER_TULIP: { color: 'red', passable: true, resource: null },
    FLOWER_BLUEBELL: { color: 'blue', passable: true, resource: null },
    BUSH: { color: 'darkgreen', passable: true, resource: 'wood' },
    PINE_TREE: { color: 'darkgreen', passable: true, resource: 'wood' },
    LARGE_TREE: { color: 'darkgreen', passable: true, resource: 'wood' },
    EGG: { color: 'white', passable: true, resource: 'egg' },
    BADGE: { color: 'gold', passable: true, resource: 'badge' },
    FARMHOUSE: { color: 'white', passable: false, resource: null },
    IMAGE: { color: '#8844aa', passable: true, resource: null },
    TEXT: { color: '#2288cc', passable: true, resource: null },
    BRIDGE_H: { color: '#8B6914', passable: true, resource: null },
    BRIDGE_V: { color: '#8B6914', passable: true, resource: null },
    GRASS_EDGE: { color: 'green', passable: true, resource: null },
    GRASS_CORNER: { color: 'green', passable: true, resource: null },
    GRASS_CORNER_INSIDE: { color: 'green', passable: true, resource: null },
};

// Sprite file mapping for tile types that have custom sprites
const tileSprites = new Map();
tileSprites.set(tileTypes.GRASS_EDGE, 'tile-grass-edge.gif');
tileSprites.set(tileTypes.GRASS_CORNER, 'tile-grass-corner.gif');
tileSprites.set(tileTypes.GRASS_CORNER_INSIDE, 'tile-grass-corner-inside.gif');

export function getTileSprite(tileType) {
    return tileSprites.get(tileType) || null;
}

// Tile rotation stored per-position: "x,y" -> array of rotation degrees
// Each element corresponds to a rotatable tile in the layer stack (bottom to top)
const tileRotations = new Map();

export function getTileRotations(x, y) {
    return tileRotations.get(`${x},${y}`) || [];
}

// Get rotation for the first (or only) rotatable tile at this position
export function getTileRotation(x, y) {
    const rots = tileRotations.get(`${x},${y}`);
    return rots && rots.length > 0 ? rots[0] : 0;
}

export function setTileRotations(x, y, rotations) {
    if (!rotations || rotations.length === 0 || rotations.every(r => r === 0)) {
        tileRotations.delete(`${x},${y}`);
    } else {
        tileRotations.set(`${x},${y}`, [...rotations]);
    }
}

export function setTileRotation(x, y, degrees) {
    setTileRotations(x, y, [degrees]);
}

export function pushTileRotation(x, y, degrees) {
    const rots = getTileRotations(x, y);
    rots.push(degrees);
    setTileRotations(x, y, rots);
}

export function popTileRotation(x, y) {
    const rots = getTileRotations(x, y);
    rots.pop();
    setTileRotations(x, y, rots);
}

export function clearTileRotation(x, y) {
    tileRotations.delete(`${x},${y}`);
}

export function clearAllTileRotations() {
    tileRotations.clear();
}

// Grass edge flags stored per-position: "x,y" -> edge flag bitmask
// Used for procedural grass tile generation
const grassEdgeFlags = new Map();

export function getGrassEdgeFlags(x, y) {
    return grassEdgeFlags.get(`${x},${y}`) || 0;
}

export function setGrassEdgeFlags(x, y, flags) {
    if (!flags || flags === 0) {
        grassEdgeFlags.delete(`${x},${y}`);
    } else {
        grassEdgeFlags.set(`${x},${y}`, flags);
    }
}

export function clearGrassEdgeFlags(x, y) {
    grassEdgeFlags.delete(`${x},${y}`);
}

export function clearAllGrassEdgeFlags() {
    grassEdgeFlags.clear();
}

// Dirt edge flags stored per-position: "x,y" -> edge flag bitmask
// Used for procedural dirt tile generation
const dirtEdgeFlags = new Map();

export function getDirtEdgeFlags(x, y) {
    return dirtEdgeFlags.get(`${x},${y}`) || 0;
}

export function setDirtEdgeFlags(x, y, flags) {
    if (!flags || flags === 0) {
        dirtEdgeFlags.delete(`${x},${y}`);
    } else {
        dirtEdgeFlags.set(`${x},${y}`, flags);
    }
}

export function clearDirtEdgeFlags(x, y) {
    dirtEdgeFlags.delete(`${x},${y}`);
}

export function clearAllDirtEdgeFlags() {
    dirtEdgeFlags.clear();
}

// Tile types that support rotation via double-click
const rotatableTypes = new Set();
rotatableTypes.add(tileTypes.GRASS_EDGE);
rotatableTypes.add(tileTypes.GRASS_CORNER);
rotatableTypes.add(tileTypes.GRASS_CORNER_INSIDE);

export function isRotatable(tileType) {
    return rotatableTypes.has(tileType);
}

// Tile types that can be stacked (multiple on same position)
const stackableTypes = new Set();
stackableTypes.add(tileTypes.GRASS_CORNER_INSIDE);

export function isStackable(tileType) {
    return stackableTypes.has(tileType);
}

// Rotate the topmost rotatable tile at a position
export function rotateTile(x, y) {
    const tiles = map[y][x];
    if (!tiles || tiles.length === 0) return false;
    const rots = getTileRotations(x, y);
    if (rots.length === 0) {
        // Check if there's a rotatable tile but no rotation stored yet
        if (!tiles.some(t => isRotatable(t))) return false;
        setTileRotations(x, y, [90]);
        return true;
    }
    // Rotate the last entry (topmost)
    rots[rots.length - 1] = (rots[rots.length - 1] + 90) % 360;
    setTileRotations(x, y, rots);
    return true;
}

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

export function replaceMap(newMap, newWidth, newHeight) {
    MAP_WIDTH_TILES = newWidth;
    MAP_HEIGHT_TILES = newHeight;
    map.length = 0;
    newMap.forEach(row => map.push(row));
}

export async function initializeMap() {
    // Load map data from JSON
    const mapData = await loadMapData();
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

export function initializeMapFromData(gameData) {
    MAP_WIDTH_TILES = gameData.width;
    MAP_HEIGHT_TILES = gameData.height;
    map = gameData.map;

    farmhouse = null;
    chickenCoop = null;
    signObj = null;
    window.farmhouse = null;
    window.chickenCoop = null;
    window.signObj = null;

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

// Compute integer pixel rect for a tile — each tile starts exactly where the
// previous one ended, eliminating sub-pixel gaps on the canvas.
function tileRect(x, y, tileSize) {
    const px = Math.round(x * tileSize);
    const py = Math.round(y * tileSize);
    const w = Math.round((x + 1) * tileSize) - px;
    const h = Math.round((y + 1) * tileSize) - py;
    return { px, py, w, h };
}

function renderTileToCanvas(ctx, x, y, tileSize) {
    const tiles = map[y][x];
    const { px, py, w, h } = tileRect(x, y, tileSize);

    // Check if this tile has procedural edge flags
    const grassEdgeFlag = getGrassEdgeFlags(x, y);
    const dirtEdgeFlag = getDirtEdgeFlags(x, y);

    // Determine the base terrain tile
    const hasBridgeH = tiles.find(t => t === tileTypes.BRIDGE_H);
    const hasBridgeV = tiles.find(t => t === tileTypes.BRIDGE_V);
    const hasDirt = tiles.find(t => t === tileTypes.DIRT);
    const hasGrass = tiles.find(t => t === tileTypes.GRASS);

    // Handle bridges specially
    if (hasBridgeH || hasBridgeV) {
        const baseTile = hasBridgeH ? 'bridge-horizontal.gif' : 'bridge-vertical.gif';
        const spriteCanvas = getSpriteCanvas(baseTile);
        if (spriteCanvas) {
            ctx.drawImage(spriteCanvas, px, py, w, h);
        }
    }
    // Dirt on top of grass - render grass first, then procedural dirt
    else if (hasDirt && hasGrass && dirtEdgeFlag >= 0) {
        // Check which is on top by comparing indices
        const grassIndex = tiles.findIndex(t => t === tileTypes.GRASS);
        const dirtIndex = tiles.findIndex(t => t === tileTypes.DIRT);

        if (dirtIndex > grassIndex) {
            // Dirt is on top of grass
            // Draw water first
            const waterCanvas = getSpriteCanvas('tile-water.gif');
            if (waterCanvas) {
                ctx.drawImage(waterCanvas, px, py, w, h);
            }
            // Draw procedural grass underneath (no edges since it's covered)
            const grassCanvas = getGrassTileCanvas(0, tileSize);
            if (grassCanvas) {
                ctx.drawImage(grassCanvas, px, py, w, h);
            }
            // Draw procedural dirt with edges on top
            const dirtCanvas = getDirtTileCanvas(dirtEdgeFlag, tileSize);
            if (dirtCanvas) {
                ctx.drawImage(dirtCanvas, px, py, w, h);
            }
        } else {
            // Grass is on top of dirt
            // Draw water first
            const waterCanvas = getSpriteCanvas('tile-water.gif');
            if (waterCanvas) {
                ctx.drawImage(waterCanvas, px, py, w, h);
            }
            // Draw procedural dirt underneath (no edges since it's covered)
            const dirtCanvas = getDirtTileCanvas(0, tileSize);
            if (dirtCanvas) {
                ctx.drawImage(dirtCanvas, px, py, w, h);
            }
            // Draw procedural grass with edges on top
            const grassCanvas = getGrassTileCanvas(grassEdgeFlag, tileSize);
            if (grassCanvas) {
                ctx.drawImage(grassCanvas, px, py, w, h);
            }
        }
    }
    // Grass only (no dirt in this tile)
    else if (hasGrass && !hasDirt) {
        // Draw water first
        const waterCanvas = getSpriteCanvas('tile-water.gif');
        if (waterCanvas) {
            ctx.drawImage(waterCanvas, px, py, w, h);
        }
        // For edges, draw appropriate background strips
        if (grassEdgeFlag > 0) {
            const stripDepth = Math.floor(tileSize * 0.18);
            const cornerSize = Math.floor(tileSize * 0.35);
            const EDGE_N = 1, EDGE_S = 2, EDGE_E = 4, EDGE_W = 8;

            // Helper to check if neighbor has dirt-only (no grass underneath)
            const isDirtOnly = (nx, ny) => {
                if (nx < 0 || nx >= MAP_WIDTH_TILES || ny < 0 || ny >= MAP_HEIGHT_TILES) return false;
                const neighborTiles = map[ny][nx];
                if (!neighborTiles) return false;
                const hasDirtN = neighborTiles.some(t => t === tileTypes.DIRT);
                const hasGrassN = neighborTiles.some(t => t === tileTypes.GRASS);
                return hasDirtN && !hasGrassN;
            };

            // Check each neighbor - dirt-only gets dirt strip, dirt-on-grass gets grass strip
            const northIsDirtOnly = isDirtOnly(x, y - 1);
            const southIsDirtOnly = isDirtOnly(x, y + 1);
            const eastIsDirtOnly = isDirtOnly(x + 1, y);
            const westIsDirtOnly = isDirtOnly(x - 1, y);

            // For dirt-only neighbors, draw dirt strips
            const dirtCanvas = getDirtTileCanvas(0, tileSize);
            if (dirtCanvas) {
                if ((grassEdgeFlag & EDGE_N) && northIsDirtOnly) {
                    ctx.drawImage(dirtCanvas, 0, 0, tileSize, stripDepth, px, py, w, stripDepth);
                }
                if ((grassEdgeFlag & EDGE_S) && southIsDirtOnly) {
                    ctx.drawImage(dirtCanvas, 0, tileSize - stripDepth, tileSize, stripDepth, px, py + h - stripDepth, w, stripDepth);
                }
                if ((grassEdgeFlag & EDGE_E) && eastIsDirtOnly) {
                    ctx.drawImage(dirtCanvas, tileSize - stripDepth, 0, stripDepth, tileSize, px + w - stripDepth, py, stripDepth, h);
                }
                if ((grassEdgeFlag & EDGE_W) && westIsDirtOnly) {
                    ctx.drawImage(dirtCanvas, 0, 0, stripDepth, tileSize, px, py, stripDepth, h);
                }
                // Corners for dirt-only
                if ((grassEdgeFlag & EDGE_N) && (grassEdgeFlag & EDGE_E) && (northIsDirtOnly || eastIsDirtOnly)) {
                    ctx.drawImage(dirtCanvas, tileSize - cornerSize, 0, cornerSize, cornerSize, px + w - cornerSize, py, cornerSize, cornerSize);
                }
                if ((grassEdgeFlag & EDGE_S) && (grassEdgeFlag & EDGE_E) && (southIsDirtOnly || eastIsDirtOnly)) {
                    ctx.drawImage(dirtCanvas, tileSize - cornerSize, tileSize - cornerSize, cornerSize, cornerSize, px + w - cornerSize, py + h - cornerSize, cornerSize, cornerSize);
                }
                if ((grassEdgeFlag & EDGE_S) && (grassEdgeFlag & EDGE_W) && (southIsDirtOnly || westIsDirtOnly)) {
                    ctx.drawImage(dirtCanvas, 0, tileSize - cornerSize, cornerSize, cornerSize, px, py + h - cornerSize, cornerSize, cornerSize);
                }
                if ((grassEdgeFlag & EDGE_N) && (grassEdgeFlag & EDGE_W) && (northIsDirtOnly || westIsDirtOnly)) {
                    ctx.drawImage(dirtCanvas, 0, 0, cornerSize, cornerSize, px, py, cornerSize, cornerSize);
                }
            }

            // For dirt-on-grass neighbors, draw grass strips (to match grass layer under the dirt)
            const northIsDirtOnGrass = !northIsDirtOnly && y > 0 && map[y-1][x]?.some(t => t === tileTypes.DIRT);
            const southIsDirtOnGrass = !southIsDirtOnly && y < MAP_HEIGHT_TILES-1 && map[y+1][x]?.some(t => t === tileTypes.DIRT);
            const eastIsDirtOnGrass = !eastIsDirtOnly && x < MAP_WIDTH_TILES-1 && map[y][x+1]?.some(t => t === tileTypes.DIRT);
            const westIsDirtOnGrass = !westIsDirtOnly && x > 0 && map[y][x-1]?.some(t => t === tileTypes.DIRT);

            const grassBgCanvas = getGrassTileCanvas(0, tileSize);
            if (grassBgCanvas) {
                if ((grassEdgeFlag & EDGE_N) && northIsDirtOnGrass) {
                    ctx.drawImage(grassBgCanvas, 0, 0, tileSize, stripDepth, px, py, w, stripDepth);
                }
                if ((grassEdgeFlag & EDGE_S) && southIsDirtOnGrass) {
                    ctx.drawImage(grassBgCanvas, 0, tileSize - stripDepth, tileSize, stripDepth, px, py + h - stripDepth, w, stripDepth);
                }
                if ((grassEdgeFlag & EDGE_E) && eastIsDirtOnGrass) {
                    ctx.drawImage(grassBgCanvas, tileSize - stripDepth, 0, stripDepth, tileSize, px + w - stripDepth, py, stripDepth, h);
                }
                if ((grassEdgeFlag & EDGE_W) && westIsDirtOnGrass) {
                    ctx.drawImage(grassBgCanvas, 0, 0, stripDepth, tileSize, px, py, stripDepth, h);
                }
                // Corners for dirt-on-grass
                if ((grassEdgeFlag & EDGE_N) && (grassEdgeFlag & EDGE_E) && (northIsDirtOnGrass || eastIsDirtOnGrass)) {
                    ctx.drawImage(grassBgCanvas, tileSize - cornerSize, 0, cornerSize, cornerSize, px + w - cornerSize, py, cornerSize, cornerSize);
                }
                if ((grassEdgeFlag & EDGE_S) && (grassEdgeFlag & EDGE_E) && (southIsDirtOnGrass || eastIsDirtOnGrass)) {
                    ctx.drawImage(grassBgCanvas, tileSize - cornerSize, tileSize - cornerSize, cornerSize, cornerSize, px + w - cornerSize, py + h - cornerSize, cornerSize, cornerSize);
                }
                if ((grassEdgeFlag & EDGE_S) && (grassEdgeFlag & EDGE_W) && (southIsDirtOnGrass || westIsDirtOnGrass)) {
                    ctx.drawImage(grassBgCanvas, 0, tileSize - cornerSize, cornerSize, cornerSize, px, py + h - cornerSize, cornerSize, cornerSize);
                }
                if ((grassEdgeFlag & EDGE_N) && (grassEdgeFlag & EDGE_W) && (northIsDirtOnGrass || westIsDirtOnGrass)) {
                    ctx.drawImage(grassBgCanvas, 0, 0, cornerSize, cornerSize, px, py, cornerSize, cornerSize);
                }
            }
        }
        // Draw procedural grass with edges on top
        const grassCanvas = getGrassTileCanvas(grassEdgeFlag, tileSize);
        if (grassCanvas) {
            ctx.drawImage(grassCanvas, px, py, w, h);
        }
    }
    // Dirt only (no grass in this tile)
    else if (hasDirt && !hasGrass) {
        // Draw water first
        const waterCanvas = getSpriteCanvas('tile-water.gif');
        if (waterCanvas) {
            ctx.drawImage(waterCanvas, px, py, w, h);
        }
        // For edges, draw appropriate background strips
        if (dirtEdgeFlag > 0) {
            const stripDepth = Math.floor(tileSize * 0.18);
            const cornerSize = Math.floor(tileSize * 0.35);
            const EDGE_N = 1, EDGE_S = 2, EDGE_E = 4, EDGE_W = 8;

            // Helper to check if neighbor has grass-only (no dirt underneath)
            const isGrassOnly = (nx, ny) => {
                if (nx < 0 || nx >= MAP_WIDTH_TILES || ny < 0 || ny >= MAP_HEIGHT_TILES) return false;
                const neighborTiles = map[ny][nx];
                if (!neighborTiles) return false;
                const hasDirtN = neighborTiles.some(t => t === tileTypes.DIRT);
                const hasGrassN = neighborTiles.some(t => t === tileTypes.GRASS);
                return hasGrassN && !hasDirtN;
            };

            // Check each neighbor - grass-only gets grass strip, grass-on-dirt gets dirt strip
            const northIsGrassOnly = isGrassOnly(x, y - 1);
            const southIsGrassOnly = isGrassOnly(x, y + 1);
            const eastIsGrassOnly = isGrassOnly(x + 1, y);
            const westIsGrassOnly = isGrassOnly(x - 1, y);

            // For grass-only neighbors, draw grass strips
            const grassCanvas = getGrassTileCanvas(0, tileSize);
            if (grassCanvas) {
                if ((dirtEdgeFlag & EDGE_N) && northIsGrassOnly) {
                    ctx.drawImage(grassCanvas, 0, 0, tileSize, stripDepth, px, py, w, stripDepth);
                }
                if ((dirtEdgeFlag & EDGE_S) && southIsGrassOnly) {
                    ctx.drawImage(grassCanvas, 0, tileSize - stripDepth, tileSize, stripDepth, px, py + h - stripDepth, w, stripDepth);
                }
                if ((dirtEdgeFlag & EDGE_E) && eastIsGrassOnly) {
                    ctx.drawImage(grassCanvas, tileSize - stripDepth, 0, stripDepth, tileSize, px + w - stripDepth, py, stripDepth, h);
                }
                if ((dirtEdgeFlag & EDGE_W) && westIsGrassOnly) {
                    ctx.drawImage(grassCanvas, 0, 0, stripDepth, tileSize, px, py, stripDepth, h);
                }
                // Corners for grass-only
                if ((dirtEdgeFlag & EDGE_N) && (dirtEdgeFlag & EDGE_E) && (northIsGrassOnly || eastIsGrassOnly)) {
                    ctx.drawImage(grassCanvas, tileSize - cornerSize, 0, cornerSize, cornerSize, px + w - cornerSize, py, cornerSize, cornerSize);
                }
                if ((dirtEdgeFlag & EDGE_S) && (dirtEdgeFlag & EDGE_E) && (southIsGrassOnly || eastIsGrassOnly)) {
                    ctx.drawImage(grassCanvas, tileSize - cornerSize, tileSize - cornerSize, cornerSize, cornerSize, px + w - cornerSize, py + h - cornerSize, cornerSize, cornerSize);
                }
                if ((dirtEdgeFlag & EDGE_S) && (dirtEdgeFlag & EDGE_W) && (southIsGrassOnly || westIsGrassOnly)) {
                    ctx.drawImage(grassCanvas, 0, tileSize - cornerSize, cornerSize, cornerSize, px, py + h - cornerSize, cornerSize, cornerSize);
                }
                if ((dirtEdgeFlag & EDGE_N) && (dirtEdgeFlag & EDGE_W) && (northIsGrassOnly || westIsGrassOnly)) {
                    ctx.drawImage(grassCanvas, 0, 0, cornerSize, cornerSize, px, py, cornerSize, cornerSize);
                }
            }

            // For grass-on-dirt neighbors, draw dirt strips (to match dirt layer under the grass)
            const northIsGrassOnDirt = !northIsGrassOnly && y > 0 && map[y-1][x]?.some(t => t === tileTypes.GRASS);
            const southIsGrassOnDirt = !southIsGrassOnly && y < MAP_HEIGHT_TILES-1 && map[y+1][x]?.some(t => t === tileTypes.GRASS);
            const eastIsGrassOnDirt = !eastIsGrassOnly && x < MAP_WIDTH_TILES-1 && map[y][x+1]?.some(t => t === tileTypes.GRASS);
            const westIsGrassOnDirt = !westIsGrassOnly && x > 0 && map[y][x-1]?.some(t => t === tileTypes.GRASS);

            const dirtBgCanvas = getDirtTileCanvas(0, tileSize);
            if (dirtBgCanvas) {
                if ((dirtEdgeFlag & EDGE_N) && northIsGrassOnDirt) {
                    ctx.drawImage(dirtBgCanvas, 0, 0, tileSize, stripDepth, px, py, w, stripDepth);
                }
                if ((dirtEdgeFlag & EDGE_S) && southIsGrassOnDirt) {
                    ctx.drawImage(dirtBgCanvas, 0, tileSize - stripDepth, tileSize, stripDepth, px, py + h - stripDepth, w, stripDepth);
                }
                if ((dirtEdgeFlag & EDGE_E) && eastIsGrassOnDirt) {
                    ctx.drawImage(dirtBgCanvas, tileSize - stripDepth, 0, stripDepth, tileSize, px + w - stripDepth, py, stripDepth, h);
                }
                if ((dirtEdgeFlag & EDGE_W) && westIsGrassOnDirt) {
                    ctx.drawImage(dirtBgCanvas, 0, 0, stripDepth, tileSize, px, py, stripDepth, h);
                }
                // Corners for grass-on-dirt
                if ((dirtEdgeFlag & EDGE_N) && (dirtEdgeFlag & EDGE_E) && (northIsGrassOnDirt || eastIsGrassOnDirt)) {
                    ctx.drawImage(dirtBgCanvas, tileSize - cornerSize, 0, cornerSize, cornerSize, px + w - cornerSize, py, cornerSize, cornerSize);
                }
                if ((dirtEdgeFlag & EDGE_S) && (dirtEdgeFlag & EDGE_E) && (southIsGrassOnDirt || eastIsGrassOnDirt)) {
                    ctx.drawImage(dirtBgCanvas, tileSize - cornerSize, tileSize - cornerSize, cornerSize, cornerSize, px + w - cornerSize, py + h - cornerSize, cornerSize, cornerSize);
                }
                if ((dirtEdgeFlag & EDGE_S) && (dirtEdgeFlag & EDGE_W) && (southIsGrassOnDirt || westIsGrassOnDirt)) {
                    ctx.drawImage(dirtBgCanvas, 0, tileSize - cornerSize, cornerSize, cornerSize, px, py + h - cornerSize, cornerSize, cornerSize);
                }
                if ((dirtEdgeFlag & EDGE_N) && (dirtEdgeFlag & EDGE_W) && (northIsGrassOnDirt || westIsGrassOnDirt)) {
                    ctx.drawImage(dirtBgCanvas, 0, 0, cornerSize, cornerSize, px, py, cornerSize, cornerSize);
                }
            }
        }
        // Draw procedural dirt with edges on top
        const dirtCanvas = getDirtTileCanvas(dirtEdgeFlag, tileSize);
        if (dirtCanvas) {
            ctx.drawImage(dirtCanvas, px, py, w, h);
        }
    }
    else {
        // Water only
        const baseTile = tiles.find(t => t === tileTypes.WATER || (t.color && t.color === '#3bbcff')) ? 'tile-water.gif'
            : 'tile-water.gif';

        const spriteCanvas = getSpriteCanvas(baseTile);
        if (spriteCanvas) {
            ctx.drawImage(spriteCanvas, px, py, w, h);
        }
    }

    // Render custom-sprite tile overlays (grass edge/corner variants) with rotation
    // This handles legacy/manual placements of edge tiles
    const rotations = getTileRotations(x, y);
    let rotIdx = 0;
    for (const t of tiles) {
        const sprite = getTileSprite(t);
        if (sprite) {
            const rot = rotations[rotIdx++] || 0;
            const overlaySpriteCanvas = getSpriteCanvas(sprite);
            if (overlaySpriteCanvas) {
                if (rot) {
                    const cx = px + w / 2;
                    const cy = py + h / 2;
                    const rad = rot * Math.PI / 180;
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(rad);
                    ctx.drawImage(overlaySpriteCanvas, -w / 2, -h / 2, w, h);
                    ctx.restore();
                } else {
                    ctx.drawImage(overlaySpriteCanvas, px, py, w, h);
                }
            }
        }
    }
}

export function redrawTileOnCanvas(x, y) {
    if (!mapCanvas || !mapCtx || !mapImageEl) return;
    const tileSize = window.TILE_SIZE;
    const { px, py, w, h } = tileRect(x, y, tileSize);
    mapCtx.clearRect(px, py, w, h);
    renderTileToCanvas(mapCtx, x, y, tileSize);
    // Synchronous update so the edit is visible immediately
    mapImageEl.setAttribute('href', mapCanvas.toDataURL('image/png'));
}

export function drawMap(svg) {
    svg.innerHTML = '';
    const svgWidth = window.innerWidth;
    const svgHeight = window.innerHeight;

    const tileSize = window.TILE_SIZE;
    const offsetX = window.MAP_OFFSET_X || 0;
    const offsetY = window.MAP_OFFSET_Y || 0;

    // Fill the entire SVG area with water using an SVG pattern (2 elements instead of ~1400)
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pattern.setAttribute('id', 'water-pat');
    pattern.setAttribute('width', tileSize);
    pattern.setAttribute('height', tileSize);
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    const patternImg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    patternImg.setAttribute('href', getSpriteUrl('tile-water.gif'));
    patternImg.setAttribute('width', tileSize);
    patternImg.setAttribute('height', tileSize);
    patternImg.style.imageRendering = 'pixelated';
    pattern.appendChild(patternImg);
    defs.appendChild(pattern);
    svg.appendChild(defs);
    const waterRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    waterRect.setAttribute('width', svgWidth);
    waterRect.setAttribute('height', svgHeight);
    waterRect.setAttribute('fill', 'url(#water-pat)');
    svg.appendChild(waterRect);

    // Create map container group — all map content at grid coords, panned via transform
    const container = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    container.setAttribute('id', 'map-container');
    container.setAttribute('transform', `translate(${offsetX}, ${offsetY})`);

    // Pre-render all terrain tiles to an offscreen canvas (single SVG <image> instead of ~2040+ elements)
    if (mapBlobUrl) {
        URL.revokeObjectURL(mapBlobUrl);
        mapBlobUrl = null;
    }
    const canvasW = MAP_WIDTH_TILES * tileSize;
    const canvasH = MAP_HEIGHT_TILES * tileSize;
    mapCanvas = document.createElement('canvas');
    mapCanvas.width = canvasW;
    mapCanvas.height = canvasH;
    mapCtx = mapCanvas.getContext('2d');
    mapCtx.imageSmoothingEnabled = false;

    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
            renderTileToCanvas(mapCtx, x, y, tileSize);
        }
    }

    const terrainDataUrl = mapCanvas.toDataURL('image/png');
    mapImageEl = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    mapImageEl.setAttribute('href', terrainDataUrl);
    mapImageEl.setAttribute('x', 0);
    mapImageEl.setAttribute('y', 0);
    mapImageEl.setAttribute('width', canvasW);
    mapImageEl.setAttribute('height', canvasH);
    mapImageEl.style.imageRendering = 'pixelated';
    mapImageEl.style.zIndex = '1';
    container.appendChild(mapImageEl);

    // Draw structures
    drawStructures(container, 0, 0);

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
            } else if (top === tileTypes.FLOWER_ROSE) {
                overlay = 'flower-rose.gif';
                resourceType = 'flower';
            } else if (top === tileTypes.FLOWER_FORGETMENOT) {
                overlay = 'flower-forgetmenot.gif';
                resourceType = 'flower';
            } else if (top === tileTypes.FLOWER_TULIP) {
                overlay = 'flower-tulip.gif';
                resourceType = 'flower';
            } else if (top === tileTypes.FLOWER_BLUEBELL) {
                overlay = 'flower-bluebell.gif';
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

                if (scale > 1) {
                    const offset = (tileSize * (scale - 1)) / 2;
                    imgOverlay.setAttribute('x', x * tileSize - offset);
                    imgOverlay.setAttribute('y', y * tileSize - offset);
                    imgOverlay.setAttribute('width', tileSize * scale);
                    imgOverlay.setAttribute('height', tileSize * scale);
                } else {
                    imgOverlay.setAttribute('x', x * tileSize);
                    imgOverlay.setAttribute('y', y * tileSize);
                    imgOverlay.setAttribute('width', tileSize);
                    imgOverlay.setAttribute('height', tileSize);
                }

                imgOverlay.setAttribute('data-resource', resourceType);
                imgOverlay.style.imageRendering = 'pixelated';
                imgOverlay.style.zIndex = '2';
                container.appendChild(imgOverlay);
            }
        }
    }

    // Draw image tile blocks
    const imageGroups = imageTilesSystem.getAllGroups();
    imageGroups.forEach(group => {
        const blockX = group.x * tileSize;
        const blockY = group.y * tileSize;
        const blockW = group.width * tileSize;
        const blockH = group.height * tileSize;

        if (group.imageData) {
            const imgEl = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imgEl.setAttribute('href', group.imageData);
            imgEl.setAttribute('x', blockX);
            imgEl.setAttribute('y', blockY);
            imgEl.setAttribute('width', blockW);
            imgEl.setAttribute('height', blockH);
            imgEl.setAttribute('preserveAspectRatio', 'xMidYMid slice');
            imgEl.setAttribute('data-image-block', group.groupId);
            imgEl.style.zIndex = '2';
            container.appendChild(imgEl);
        } else {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', blockX);
            rect.setAttribute('y', blockY);
            rect.setAttribute('width', blockW);
            rect.setAttribute('height', blockH);
            rect.setAttribute('fill', 'rgba(136, 68, 170, 0.3)');
            rect.setAttribute('stroke', '#8844aa');
            rect.setAttribute('stroke-width', '2');
            rect.setAttribute('stroke-dasharray', '6,3');
            rect.setAttribute('data-image-block', group.groupId);
            rect.style.zIndex = '2';
            container.appendChild(rect);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', blockX + blockW / 2);
            text.setAttribute('y', blockY + blockH / 2 + 6);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', '#bb88dd');
            text.setAttribute('font-size', Math.min(blockW, blockH, tileSize * 1.5));
            text.setAttribute('pointer-events', 'none');
            text.textContent = '\u{1F5BC}';
            container.appendChild(text);
        }
    });

    // Draw text tile blocks
    const textGroups = textTilesSystem.getAllGroups();
    textGroups.forEach(group => {
        const blockX = group.x * tileSize;
        const blockY = group.y * tileSize;
        const blockW = group.width * tileSize;
        const blockH = group.height * tileSize;

        if (group.htmlContent) {
            const sanitized = _sanitizeHtml(group.htmlContent);
            const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
            fo.setAttribute('x', blockX);
            fo.setAttribute('y', blockY);
            fo.setAttribute('width', blockW);
            fo.setAttribute('height', blockH);
            fo.setAttribute('data-text-block', group.groupId);
            fo.style.zIndex = '2';

            const div = document.createElement('div');
            div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
            div.style.cssText = `width:100%;height:100%;background:transparent;overflow:hidden;pointer-events:none;color:#fff;font-size:${Math.max(12, tileSize * 0.5)}px;line-height:1.3;word-wrap:break-word;`;
            div.innerHTML = sanitized;
            fo.appendChild(div);
            container.appendChild(fo);
        } else {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', blockX);
            rect.setAttribute('y', blockY);
            rect.setAttribute('width', blockW);
            rect.setAttribute('height', blockH);
            rect.setAttribute('fill', 'rgba(34, 136, 204, 0.3)');
            rect.setAttribute('stroke', '#2288cc');
            rect.setAttribute('stroke-width', '2');
            rect.setAttribute('stroke-dasharray', '6,3');
            rect.setAttribute('data-text-block', group.groupId);
            rect.style.zIndex = '2';
            container.appendChild(rect);

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', blockX + blockW / 2);
            text.setAttribute('y', blockY + blockH / 2 + 6);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', '#55aadd');
            text.setAttribute('font-size', Math.min(blockW, blockH, tileSize * 1.5));
            text.setAttribute('pointer-events', 'none');
            text.textContent = 'T';
            container.appendChild(text);
        }
    });

    // Editor overlays (inside container so they pan with the map)
    if (window.mapEditor && window.mapEditor.isActive) {
        const editorGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        editorGroup.setAttribute('pointer-events', 'none');
        editorGroup.style.zIndex = '3';

        const mapRight = MAP_WIDTH_TILES * tileSize;
        const mapBottom = MAP_HEIGHT_TILES * tileSize;
        const overlayColor = 'rgba(0, 0, 0, 0.35)';

        // Darken areas outside map boundary (in grid coords)
        const bigPad = 5000; // large padding to cover viewport when panned
        const regions = [
            { x: -bigPad, y: -bigPad, w: mapRight + bigPad * 2, h: bigPad },                     // top
            { x: -bigPad, y: mapBottom, w: mapRight + bigPad * 2, h: bigPad },                    // bottom
            { x: -bigPad, y: 0, w: bigPad, h: mapBottom },                                        // left
            { x: mapRight, y: 0, w: bigPad, h: mapBottom }                                        // right
        ];
        regions.forEach(r => {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', r.x);
            rect.setAttribute('y', r.y);
            rect.setAttribute('width', r.w);
            rect.setAttribute('height', r.h);
            rect.setAttribute('fill', overlayColor);
            editorGroup.appendChild(rect);
        });

        container.appendChild(editorGroup);
    }

    // Tier-limited area overlay
    const effW = window.effectiveMapWidth || MAP_WIDTH_TILES;
    const effH = window.effectiveMapHeight || MAP_HEIGHT_TILES;
    if (effW < MAP_WIDTH_TILES || effH < MAP_HEIGHT_TILES) {
        const restrictedGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        restrictedGroup.setAttribute('pointer-events', 'none');
        const overlayColor = 'rgba(0, 0, 0, 0.4)';

        if (effW < MAP_WIDTH_TILES) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', effW * tileSize);
            rect.setAttribute('y', 0);
            rect.setAttribute('width', (MAP_WIDTH_TILES - effW) * tileSize);
            rect.setAttribute('height', effH * tileSize);
            rect.setAttribute('fill', overlayColor);
            restrictedGroup.appendChild(rect);
        }

        if (effH < MAP_HEIGHT_TILES) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', 0);
            rect.setAttribute('y', effH * tileSize);
            rect.setAttribute('width', MAP_WIDTH_TILES * tileSize);
            rect.setAttribute('height', (MAP_HEIGHT_TILES - effH) * tileSize);
            rect.setAttribute('fill', overlayColor);
            restrictedGroup.appendChild(rect);
        }

        container.appendChild(restrictedGroup);
    }

    // Dynamic elements group (player, NPCs, chickens) — inside container
    const dynamicGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    dynamicGroup.setAttribute('id', 'dynamic-elements');
    dynamicGroup.style.zIndex = '4';
    container.appendChild(dynamicGroup);

    // Append the container to svg
    svg.appendChild(container);

    // Re-attach player and entities
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

    svg.style.isolation = 'isolate';
} 