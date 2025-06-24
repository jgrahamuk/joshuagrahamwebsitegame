import { getSpriteUrl } from './spriteCache.js';

// Structure definitions
export const structures = {
    farmhouse: {
        name: 'farmhouse',
        sprite: 'farmhouse.png',
        width: 10,
        height: 6,
        position: null, // Will be set dynamically
        impassable: true
    },
    chickenCoop: {
        name: 'chicken-coop',
        sprite: 'chicken-coop.png',
        width: 5,
        height: 3,
        position: { x: 18, y: 15 },
        impassable: true
    },
    sign: {
        name: 'sign',
        sprite: 'sign-joshuagraham.png',
        width: 5,
        height: 3,
        position: { x: 33, y: 8 },
        impassable: true
    }
};

export function placeStructures(map, MAP_WIDTH_TILES, MAP_HEIGHT_TILES) {
    // Place farmhouse in the center
    const fw = structures.farmhouse.width;
    const fh = structures.farmhouse.height;
    const fx = Math.floor((MAP_WIDTH_TILES - fw) / 2);
    const fy = Math.floor((MAP_HEIGHT_TILES - fh) / 2);

    structures.farmhouse.position = { x: fx, y: fy, w: fw, h: fh };

    // Add farmhouse to map
    for (let y = fy; y < fy + fh; y++) {
        for (let x = fx; x < fx + fw; x++) {
            if (x >= 0 && y >= 0 && x < MAP_WIDTH_TILES && y < MAP_HEIGHT_TILES) {
                map[y][x].push({ color: 'white', passable: false, resource: null });
            }
        }
    }

    // Add chicken coop to map
    if (structures.chickenCoop.position) {
        const coop = structures.chickenCoop;
        for (let y = coop.position.y; y < coop.position.y + coop.height; y++) {
            for (let x = coop.position.x; x < coop.position.x + coop.width; x++) {
                if (x >= 0 && y >= 0 && x < MAP_WIDTH_TILES && y < MAP_HEIGHT_TILES) {
                    map[y][x].push({ color: 'white', passable: false, resource: null });
                }
            }
        }
    }

    // Add sign to map
    if (structures.sign.position) {
        const sign = structures.sign;
        for (let y = sign.position.y; y < sign.position.y + sign.height; y++) {
            for (let x = sign.position.x; x < sign.position.x + sign.width; x++) {
                if (x >= 0 && y >= 0 && x < MAP_WIDTH_TILES && y < MAP_HEIGHT_TILES) {
                    map[y][x].push({ color: 'white', passable: false, resource: null });
                }
            }
        }
    }
}

export function drawStructures(svg, offsetX = 0, offsetY = 0) {
    // Draw farmhouse
    if (structures.farmhouse.position) {
        const farm = structures.farmhouse;
        const imgFarm = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imgFarm.setAttribute('href', getSpriteUrl(farm.sprite));
        imgFarm.setAttribute('x', offsetX + farm.position.x * window.TILE_SIZE);
        imgFarm.setAttribute('y', offsetY + farm.position.y * window.TILE_SIZE);
        imgFarm.setAttribute('width', farm.position.w * window.TILE_SIZE);
        imgFarm.setAttribute('height', farm.position.h * window.TILE_SIZE);
        svg.appendChild(imgFarm);
    }

    // Draw chicken coop
    if (structures.chickenCoop.position) {
        const coop = structures.chickenCoop;
        const imgCoop = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imgCoop.setAttribute('href', getSpriteUrl(coop.sprite));
        imgCoop.setAttribute('x', offsetX + coop.position.x * window.TILE_SIZE);
        imgCoop.setAttribute('y', offsetY + coop.position.y * window.TILE_SIZE);
        imgCoop.setAttribute('width', coop.width * window.TILE_SIZE);
        imgCoop.setAttribute('height', coop.height * window.TILE_SIZE);
        svg.appendChild(imgCoop);
    }

    // Draw sign
    if (structures.sign.position) {
        const sign = structures.sign;
        const imgSign = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imgSign.setAttribute('href', getSpriteUrl(sign.sprite));
        imgSign.setAttribute('x', offsetX + sign.position.x * window.TILE_SIZE);
        imgSign.setAttribute('y', offsetY + sign.position.y * window.TILE_SIZE);
        imgSign.setAttribute('width', sign.width * window.TILE_SIZE);
        imgSign.setAttribute('height', sign.height * window.TILE_SIZE);
        svg.appendChild(imgSign);
    }
} 