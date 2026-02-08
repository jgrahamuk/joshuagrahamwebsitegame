import { placeStructures } from './structures.js';
import { loadMapData, convertMapDataToGameFormat } from './mapLoader.js';
import { getSpriteUrl } from './spriteCache.js';
import { drawStructures } from './structures.js';
import { imageTilesSystem } from './imageTiles.js';
import { textTilesSystem } from './textTiles.js';

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

export function drawMap(svg) {
    svg.innerHTML = '';
    const svgWidth = window.innerWidth;
    const svgHeight = window.innerHeight;

    // Use pre-calculated tile size and offsets from updateTileSize/updateViewport
    const tileSize = window.TILE_SIZE;
    const offsetX = window.MAP_OFFSET_X || 0;
    const offsetY = window.MAP_OFFSET_Y || 0;

    // Small overlap to prevent gaps from floating-point rounding
    const tileOverlap = 0.5;
    const renderSize = tileSize + tileOverlap;

    // Fill the entire SVG area with water tiles (no gaps)
    const numXTiles = Math.ceil(svgWidth / tileSize) + 1;
    const numYTiles = Math.ceil(svgHeight / tileSize) + 1;
    for (let y = 0; y < numYTiles; y++) {
        for (let x = 0; x < numXTiles; x++) {
            const imgWater = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imgWater.setAttribute('href', getSpriteUrl('tile-water.gif'));
            imgWater.setAttribute('x', x * tileSize);
            imgWater.setAttribute('y', y * tileSize);
            imgWater.setAttribute('width', renderSize);
            imgWater.setAttribute('height', renderSize);
            imgWater.style.imageRendering = 'pixelated';
            svg.appendChild(imgWater);
        }
    }

    // Draw the map tiles
    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
            const tiles = map[y][x];
            let baseTile = tiles.find(t => t === tileTypes.BRIDGE_H) ? 'bridge-horizontal.gif'
                : tiles.find(t => t === tileTypes.BRIDGE_V) ? 'bridge-vertical.gif'
                    : tiles.find(t => t === tileTypes.DIRT) ? 'tile-dirt.gif'
                        : tiles.find(t => t === tileTypes.GRASS) ? 'tile-grass.gif'
                            : tiles.find(t => t === tileTypes.WATER || (t.color && t.color === '#3bbcff')) ? 'tile-water.gif'
                                : 'tile-grass.gif';
            let basePath = getSpriteUrl(baseTile);
            const imgBase = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imgBase.setAttribute('href', basePath);
            imgBase.setAttribute('x', offsetX + x * tileSize);
            imgBase.setAttribute('y', offsetY + y * tileSize);
            imgBase.setAttribute('width', renderSize);
            imgBase.setAttribute('height', renderSize);
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

    // Draw image tile blocks
    const imageGroups = imageTilesSystem.getAllGroups();
    imageGroups.forEach(group => {
        const blockX = offsetX + group.x * tileSize;
        const blockY = offsetY + group.y * tileSize;
        const blockW = group.width * tileSize;
        const blockH = group.height * tileSize;

        if (group.imageData) {
            // Draw the uploaded image stretched across the block
            const imgEl = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imgEl.setAttribute('href', group.imageData);
            imgEl.setAttribute('x', blockX);
            imgEl.setAttribute('y', blockY);
            imgEl.setAttribute('width', blockW);
            imgEl.setAttribute('height', blockH);
            imgEl.setAttribute('preserveAspectRatio', 'xMidYMid slice');
            imgEl.setAttribute('data-image-block', group.groupId);
            imgEl.style.zIndex = '2';
            svg.appendChild(imgEl);
        } else {
            // Draw placeholder for image tiles without an uploaded image
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
            svg.appendChild(rect);

            // Add icon text in center
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', blockX + blockW / 2);
            text.setAttribute('y', blockY + blockH / 2 + 6);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', '#bb88dd');
            text.setAttribute('font-size', Math.min(blockW, blockH, tileSize * 1.5));
            text.setAttribute('pointer-events', 'none');
            text.textContent = '\u{1F5BC}';
            svg.appendChild(text);
        }
    });

    // Draw text tile blocks
    const textGroups = textTilesSystem.getAllGroups();
    textGroups.forEach(group => {
        const blockX = offsetX + group.x * tileSize;
        const blockY = offsetY + group.y * tileSize;
        const blockW = group.width * tileSize;
        const blockH = group.height * tileSize;

        if (group.htmlContent) {
            // Sanitize the HTML content before rendering
            const sanitized = _sanitizeHtml(group.htmlContent);

            // Render via SVG foreignObject with transparent background
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
            svg.appendChild(fo);
        } else {
            // Draw placeholder for text tiles without content
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
            svg.appendChild(rect);

            // Add "T" text in center
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', blockX + blockW / 2);
            text.setAttribute('y', blockY + blockH / 2 + 6);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', '#55aadd');
            text.setAttribute('font-size', Math.min(blockW, blockH, tileSize * 1.5));
            text.setAttribute('pointer-events', 'none');
            text.textContent = 'T';
            svg.appendChild(text);
        }
    });

    // If map editor is active, darken water outside the map boundary
    if (window.mapEditor && window.mapEditor.isActive) {
        const editorGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        editorGroup.setAttribute('pointer-events', 'none');
        editorGroup.style.zIndex = '3';

        const mapLeft = offsetX;
        const mapTop = offsetY;
        const mapRight = offsetX + MAP_WIDTH_TILES * tileSize;
        const mapBottom = offsetY + MAP_HEIGHT_TILES * tileSize;

        // Dark overlay rectangles around the map area (top, bottom, left, right)
        const overlayColor = 'rgba(0, 0, 0, 0.35)';
        const regions = [
            { x: 0, y: 0, w: svgWidth, h: mapTop },                          // top
            { x: 0, y: mapBottom, w: svgWidth, h: svgHeight - mapBottom },     // bottom
            { x: 0, y: mapTop, w: mapLeft, h: mapBottom - mapTop },            // left
            { x: mapRight, y: mapTop, w: svgWidth - mapRight, h: mapBottom - mapTop } // right
        ];
        regions.forEach(r => {
            if (r.w > 0 && r.h > 0) {
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', r.x);
                rect.setAttribute('y', r.y);
                rect.setAttribute('width', r.w);
                rect.setAttribute('height', r.h);
                rect.setAttribute('fill', overlayColor);
                editorGroup.appendChild(rect);
            }
        });

        svg.appendChild(editorGroup);
    }

    // Draw dark overlay over tiles outside effective (tier-limited) bounds
    const effW = window.effectiveMapWidth || MAP_WIDTH_TILES;
    const effH = window.effectiveMapHeight || MAP_HEIGHT_TILES;
    if (effW < MAP_WIDTH_TILES || effH < MAP_HEIGHT_TILES) {
        const restrictedGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        restrictedGroup.setAttribute('pointer-events', 'none');
        const overlayColor = 'rgba(0, 0, 0, 0.4)';

        // Right strip: columns effW..MAP_WIDTH_TILES, rows 0..effH
        if (effW < MAP_WIDTH_TILES) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', offsetX + effW * tileSize);
            rect.setAttribute('y', offsetY);
            rect.setAttribute('width', (MAP_WIDTH_TILES - effW) * tileSize);
            rect.setAttribute('height', effH * tileSize);
            rect.setAttribute('fill', overlayColor);
            restrictedGroup.appendChild(rect);
        }

        // Bottom strip: rows effH..MAP_HEIGHT_TILES, full width
        if (effH < MAP_HEIGHT_TILES) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', offsetX);
            rect.setAttribute('y', offsetY + effH * tileSize);
            rect.setAttribute('width', MAP_WIDTH_TILES * tileSize);
            rect.setAttribute('height', (MAP_HEIGHT_TILES - effH) * tileSize);
            rect.setAttribute('fill', overlayColor);
            restrictedGroup.appendChild(rect);
        }

        svg.appendChild(restrictedGroup);
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