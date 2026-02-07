import { getSpriteUrl } from './spriteCache.js';

export function placeStructures(map, MAP_WIDTH_TILES, MAP_HEIGHT_TILES) {
    // Place farmhouse
    if (window.farmhouse) {
        for (let y = window.farmhouse.y; y < window.farmhouse.y + window.farmhouse.h; y++) {
            for (let x = window.farmhouse.x; x < window.farmhouse.x + window.farmhouse.w; x++) {
                if (x >= 0 && y >= 0 && x < MAP_WIDTH_TILES && y < MAP_HEIGHT_TILES) {
                    map[y][x].push({ color: 'white', passable: false, resource: null });
                }
            }
        }
    }

    // Place chicken coop
    if (window.chickenCoop) {
        for (let y = window.chickenCoop.y; y < window.chickenCoop.y + window.chickenCoop.h; y++) {
            for (let x = window.chickenCoop.x; x < window.chickenCoop.x + window.chickenCoop.w; x++) {
                if (x >= 0 && y >= 0 && x < MAP_WIDTH_TILES && y < MAP_HEIGHT_TILES) {
                    map[y][x].push({ color: 'white', passable: false, resource: null });
                }
            }
        }
    }

    // Place sign
    if (window.signObj) {
        for (let y = window.signObj.y; y < window.signObj.y + window.signObj.h; y++) {
            for (let x = window.signObj.x; x < window.signObj.x + window.signObj.w; x++) {
                if (x >= 0 && y >= 0 && x < MAP_WIDTH_TILES && y < MAP_HEIGHT_TILES) {
                    map[y][x].push({ color: 'white', passable: false, resource: null });
                }
            }
        }
    }

    // Place portals
    if (window.portals) {
        window.portals.forEach(portal => {
            for (let y = portal.y; y < portal.y + portal.h; y++) {
                for (let x = portal.x; x < portal.x + portal.w; x++) {
                    if (x >= 0 && y >= 0 && x < MAP_WIDTH_TILES && y < MAP_HEIGHT_TILES) {
                        map[y][x].push({ color: 'white', passable: false, resource: null });
                    }
                }
            }
        });
    }
}

export function drawStructures(svg, offsetX = 0, offsetY = 0) {
    const tileSize = window.TILE_SIZE;

    // Draw farmhouse
    if (window.farmhouse) {
        const imgFarm = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imgFarm.setAttribute('href', getSpriteUrl('farmhouse.gif'));
        imgFarm.setAttribute('x', offsetX + window.farmhouse.x * tileSize);
        imgFarm.setAttribute('y', offsetY + window.farmhouse.y * tileSize);
        imgFarm.setAttribute('width', window.farmhouse.w * tileSize);
        imgFarm.setAttribute('height', window.farmhouse.h * tileSize);
        svg.appendChild(imgFarm);
    }

    // Draw chicken coop
    if (window.chickenCoop) {
        const imgCoop = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imgCoop.setAttribute('href', getSpriteUrl('chicken-coop.gif'));
        imgCoop.setAttribute('x', offsetX + window.chickenCoop.x * tileSize);
        imgCoop.setAttribute('y', offsetY + window.chickenCoop.y * tileSize);
        imgCoop.setAttribute('width', window.chickenCoop.w * tileSize);
        imgCoop.setAttribute('height', window.chickenCoop.h * tileSize);
        svg.appendChild(imgCoop);
    }

    // Draw sign
    if (window.signObj) {
        const imgSign = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imgSign.setAttribute('href', getSpriteUrl('sign-joshuagraham.gif'));
        imgSign.setAttribute('x', offsetX + window.signObj.x * tileSize);
        imgSign.setAttribute('y', offsetY + window.signObj.y * tileSize);
        imgSign.setAttribute('width', window.signObj.w * tileSize);
        imgSign.setAttribute('height', window.signObj.h * tileSize);
        svg.appendChild(imgSign);
    }

    // Draw portals
    if (window.portals) {
        window.portals.forEach(portal => {
            const imgPortal = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imgPortal.setAttribute('href', getSpriteUrl('portal-purple.gif'));
            imgPortal.setAttribute('x', offsetX + portal.x * tileSize);
            imgPortal.setAttribute('y', offsetY + portal.y * tileSize);
            imgPortal.setAttribute('width', portal.w * tileSize);
            imgPortal.setAttribute('height', portal.h * tileSize);
            svg.appendChild(imgPortal);
        });
    }
} 