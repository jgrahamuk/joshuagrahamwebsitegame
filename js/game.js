import { initializeMap, getTile, randomGrassOrDirt, tileTypes, map, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, farmhouse, chickenCoop, signObj, setMapSize } from './map.js';
import { findPath } from './movement.js';
import { Player } from './player.js';
import { Chicken } from './chickens.js';
import { NPC, npcDefinitions } from './npcs.js';
import { preloadSprites, getSpriteUrl } from './spriteCache.js';

window.TILE_SIZE = 40;

const gameContainer = document.getElementById('game-container');
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
gameContainer.appendChild(svg);

function updateTileSize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    window.TILE_SIZE = Math.floor(Math.min(w / MAP_WIDTH_TILES, h / MAP_HEIGHT_TILES));
    svg.setAttribute('width', MAP_WIDTH_TILES * window.TILE_SIZE);
    svg.setAttribute('height', MAP_HEIGHT_TILES * window.TILE_SIZE);
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
    // Draw farmhouse (as one image)
    if (farmhouse) {
        const imgFarm = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imgFarm.setAttribute('href', getSpriteUrl('farmhouse.png'));
        imgFarm.setAttribute('x', farmhouse.x * window.TILE_SIZE);
        imgFarm.setAttribute('y', farmhouse.y * window.TILE_SIZE);
        imgFarm.setAttribute('width', farmhouse.w * window.TILE_SIZE);
        imgFarm.setAttribute('height', farmhouse.h * window.TILE_SIZE);
        svg.appendChild(imgFarm);
    }
    // Draw chicken coop (as one image)
    if (chickenCoop) {
        const imgCoop = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imgCoop.setAttribute('href', getSpriteUrl('chicken-coop.png'));
        imgCoop.setAttribute('x', chickenCoop.x * window.TILE_SIZE);
        imgCoop.setAttribute('y', chickenCoop.y * window.TILE_SIZE);
        imgCoop.setAttribute('width', chickenCoop.w * window.TILE_SIZE);
        imgCoop.setAttribute('height', chickenCoop.h * window.TILE_SIZE);
        svg.appendChild(imgCoop);
    }
    // Draw sign (as one image)
    if (signObj) {
        const imgSign = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imgSign.setAttribute('href', getSpriteUrl('sign-joshuagraham.png'));
        imgSign.setAttribute('x', signObj.x * window.TILE_SIZE);
        imgSign.setAttribute('y', signObj.y * window.TILE_SIZE);
        imgSign.setAttribute('width', signObj.w * window.TILE_SIZE);
        imgSign.setAttribute('height', signObj.h * window.TILE_SIZE);
        svg.appendChild(imgSign);
    }
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

function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent) || window.innerWidth < 700;
}

function getMapDims() {
    if (isMobile()) {
        return { width: 20, height: 40 };
    } else {
        return { width: 64, height: 48 };
    }
}

preloadSprites().then(() => {
    const dims = getMapDims();
    setMapSize(dims.width, dims.height);
    updateTileSize();
    window.addEventListener('resize', () => {
        const dims = getMapDims();
        setMapSize(dims.width, dims.height);
        updateTileSize();
        initializeMap();
        drawMap();
        player.updatePosition();
        chickens.forEach(c => c.updatePosition());
        npcs.forEach(n => n.updatePosition());
    });

    initializeMap();
    drawMap();

    // Find a valid player start
    let start = randomGrassOrDirt();
    window.player = new Player(svg, start.x, start.y);

    // Chickens: always guarantee at least one on land
    window.chickens = [];
    let firstChickenPlaced = false;
    for (let i = 0; i < 3; i++) {
        let chicken;
        if (!firstChickenPlaced) {
            // Force first chicken to a valid land tile
            const pos = randomGrassOrDirt();
            chicken = new Chicken(svg);
            chicken.x = pos.x;
            chicken.y = pos.y;
            chicken.updatePosition();
            firstChickenPlaced = true;
        } else {
            chicken = new Chicken(svg);
        }
        window.chickens.push(chicken);
    }

    // NPCs
    window.npcs = npcDefinitions.map(def => new NPC(svg, def.name, def.message));

    // Main animation loop
    setInterval(() => {
        const now = Date.now();
        window.chickens.forEach(c => c.tick(now));
        window.npcs.forEach(n => n.tick(now));
    }, 50);

    // Player movement and NPC interaction
    svg.addEventListener('click', (e) => {
        const rect = svg.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / window.TILE_SIZE);
        const y = Math.floor((e.clientY - rect.top) / window.TILE_SIZE);

        if (x >= 0 && x < MAP_WIDTH_TILES && y >= 0 && y < MAP_HEIGHT_TILES) {
            // Check if clicking on an NPC or surrounding tiles
            const clickedNPC = window.npcs.find(npc => npc.isClicked(x, y));
            if (clickedNPC && clickedNPC.isNearPlayer(window.player.x, window.player.y)) {
                // Dismiss any other NPC messages first
                window.npcs.filter(npc => npc !== clickedNPC).forEach(npc => npc.hideMessage());
                clickedNPC.showMessage();
                return;
            }

            // Check if clicking on a resource
            const tile = getTile(x, y);
            if (tile && tile.resource) {
                // Move to the resource tile
                const start = { x: window.player.x, y: window.player.y };
                const end = { x, y };
                const path = findPath(start, end, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES);
                if (path) {
                    window.player.moveTo(path.slice(1));
                }
                return;
            }

            // Check if clicking on an NPC (not adjacent)
            if (clickedNPC) {
                // Move to a tile adjacent to the NPC
                const adjacentTiles = [];
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = clickedNPC.x + dx;
                        const ny = clickedNPC.y + dy;
                        if (nx >= 0 && ny >= 0 && nx < MAP_WIDTH_TILES && ny < MAP_HEIGHT_TILES) {
                            const adjacentTile = getTile(nx, ny);
                            if (adjacentTile && adjacentTile.passable) {
                                adjacentTiles.push({ x: nx, y: ny });
                            }
                        }
                    }
                }

                if (adjacentTiles.length > 0) {
                    // Find the closest adjacent tile
                    let closestTile = adjacentTiles[0];
                    let closestDistance = Math.abs(window.player.x - closestTile.x) + Math.abs(window.player.y - closestTile.y);

                    adjacentTiles.forEach(tile => {
                        const distance = Math.abs(window.player.x - tile.x) + Math.abs(window.player.y - tile.y);
                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestTile = tile;
                        }
                    });

                    const start = { x: window.player.x, y: window.player.y };
                    const path = findPath(start, closestTile, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES);
                    if (path) {
                        window.player.moveTo(path.slice(1));
                    }
                }
                return;
            }

            // Otherwise, move player to empty tile
            const start = { x: window.player.x, y: window.player.y };
            const end = { x, y };
            if (tile.passable) {
                const path = findPath(start, end, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES);
                if (path) window.player.moveTo(path.slice(1));
            }
        }

        // Only dismiss NPC messages when NOT clicking on an NPC
        const clickedNPC = window.npcs.find(npc => npc.isClicked(x, y));
        if (!clickedNPC) {
            window.npcs.forEach(npc => npc.hideMessage());
        }
    });
}); 