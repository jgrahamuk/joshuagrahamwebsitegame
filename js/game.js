import { initializeMap, getTile, randomGrassOrDirt, tileTypes, map, MAP_WIDTH_TILES, MAP_HEIGHT_TILES } from './map.js';
import { findPath } from './movement.js';
import { Player } from './player.js';
import { Chicken } from './chickens.js';

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
updateTileSize();
window.addEventListener('resize', () => {
    updateTileSize();
    drawMap();
    player.updatePosition();
    chickens.forEach(c => c.updatePosition());
});

initializeMap();

function drawMap() {
    svg.innerHTML = '';
    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
            const tiles = map[y][x];
            let baseTile = tiles.find(t => t === tileTypes.DIRT) ? 'tile-dirt.png'
                : tiles.find(t => t === tileTypes.GRASS) ? 'tile-grass.png'
                    : tiles.find(t => t === tileTypes.WATER || (t.color && t.color === '#3bbcff')) ? 'tile-water.png'
                        : 'tile-grass.png';
            let basePath = `resources/images/${baseTile}`;
            const imgBase = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imgBase.setAttribute('href', basePath);
            imgBase.setAttribute('x', x * window.TILE_SIZE);
            imgBase.setAttribute('y', y * window.TILE_SIZE);
            imgBase.setAttribute('width', window.TILE_SIZE);
            imgBase.setAttribute('height', window.TILE_SIZE);
            svg.appendChild(imgBase);
            // Overlay for resources
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
                imgOverlay.setAttribute('href', `resources/images/${overlay}`);
                imgOverlay.setAttribute('x', x * window.TILE_SIZE);
                imgOverlay.setAttribute('y', y * window.TILE_SIZE);
                imgOverlay.setAttribute('width', window.TILE_SIZE);
                imgOverlay.setAttribute('height', window.TILE_SIZE);
                svg.appendChild(imgOverlay);
            }
        }
    }
}
drawMap();

// Find a valid player start
let start = randomGrassOrDirt();
const player = new Player(svg, start.x, start.y);

// Chickens
const chickens = [new Chicken(svg), new Chicken(svg), new Chicken(svg)];

// Main chicken animation loop
setInterval(() => {
    const now = Date.now();
    chickens.forEach(c => c.tick(now));
}, 50);

// Player movement
svg.addEventListener('click', (e) => {
    const rect = svg.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / window.TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / window.TILE_SIZE);
    if (x >= 0 && x < MAP_WIDTH_TILES && y >= 0 && y < MAP_HEIGHT_TILES) {
        const start = { x: player.x, y: player.y };
        const end = { x, y };
        const tile = getTile(x, y);
        if (tile.passable) {
            const path = findPath(start, end, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES);
            if (path) player.moveTo(path.slice(1));
        }
    }
}); 