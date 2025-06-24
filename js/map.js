// Map generation and tile helpers
export const tileTypes = {
    WATER: { color: 'blue', passable: false, resource: null },
    DIRT: { color: 'brown', passable: true, resource: null },
    GRASS: { color: 'green', passable: true, resource: null },
    ROCK: { color: 'grey', passable: false, resource: 'stone' },
    FLOWER: { color: 'pink', passable: true, resource: null },
    SMALL_TREE: { color: 'darkgreen', passable: false, resource: 'wood' },
    LARGE_TREE: { color: 'darkgreen', passable: false, resource: 'wood' },
    FARMHOUSE: { color: 'white', passable: false, resource: null },
};
export let MAP_WIDTH_TILES = 64;
export let MAP_HEIGHT_TILES = 48;
export let map = [];
export let farmhouse = null; // {x, y, w, h}
export let chickenCoop = { x: 18, y: 15, w: 5, h: 3 }; // {x, y, w, h} in tiles
export let signObj = { x: 29, y: 8, w: 13, h: 7 }; // {x, y, w, h} in tiles

export function setMapSize(width, height) {
    MAP_WIDTH_TILES = width;
    MAP_HEIGHT_TILES = height;
}

export function initializeMap() {
    map.length = 0; // clear any previous map
    const cx = MAP_WIDTH_TILES / 2;
    const cy = MAP_HEIGHT_TILES / 2;

    // Detect mobile for different island shapes
    const isMobile = MAP_WIDTH_TILES < 30; // Mobile is 20x40, desktop is 64x48

    // Smaller island to ensure water on sides
    let baseRadius = Math.min(MAP_WIDTH_TILES, MAP_HEIGHT_TILES) / 2.8;
    if (isMobile) {
        // Make island much taller on mobile
        baseRadius = Math.min(MAP_WIDTH_TILES, MAP_HEIGHT_TILES) / 2.2;
    }

    const noise = (x, y) => 0.8 + 0.25 * Math.sin(x * 0.4) * Math.cos(y * 0.3 + x * 0.1);

    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        map[y] = [];
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
            map[y][x] = [tileTypes.WATER]; // Base layer
            // Rippling water border
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const n = noise(x, y);
            if (dist < baseRadius * n * 1.08 && dist > baseRadius * n * 0.98) {
                // Rippling water
                map[y][x][0] = { ...tileTypes.WATER, color: '#3bbcff' };
            }
            // Main island - make it taller on mobile
            if (isMobile) {
                // Use elliptical shape for mobile to make it taller
                const ellipticalDist = Math.sqrt((dx * dx) / 1.5 + (dy * dy) / 0.8);
                if (ellipticalDist < baseRadius * n) {
                    map[y][x].push(tileTypes.GRASS);
                }
            } else {
                // Regular circular shape for desktop
                if (dist < baseRadius * n) {
                    map[y][x].push(tileTypes.GRASS);
                }
            }
        }
    }

    // Add second island - positioned more towards center
    const secondIslandX = Math.floor(MAP_WIDTH_TILES * 0.75);
    const secondIslandY = Math.floor(MAP_HEIGHT_TILES * 0.65);
    const secondIslandRadius = Math.min(MAP_WIDTH_TILES, MAP_HEIGHT_TILES) / 5.0;
    const secondNoise = (x, y) => 0.8 + 0.25 * Math.sin(x * 0.3) * Math.cos(y * 0.4 + x * 0.2);

    for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
        for (let x = 0; x < MAP_WIDTH_TILES; x++) {
            const dx = x - secondIslandX;
            const dy = y - secondIslandY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const n = secondNoise(x, y);
            if (dist < secondIslandRadius * n) {
                map[y][x].push(tileTypes.GRASS);
            }
        }
    }

    // Add dirt patches and clearings
    for (let i = 0; i < 10; i++) {
        const px = Math.floor(cx + (Math.random() - 0.5) * baseRadius * 1.2);
        const py = Math.floor(cy + (Math.random() - 0.5) * baseRadius * 1.2);
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const x = px + dx, y = py + dy;
                if (x > 0 && x < MAP_WIDTH_TILES && y > 0 && y < MAP_HEIGHT_TILES && map[y][x].length > 1) {
                    map[y][x][map[y][x].length - 1] = tileTypes.DIRT;
                }
            }
        }
    }

    // Add resource clusters
    function placeResource(type, count, clusterSize) {
        for (let i = 0; i < count; i++) {
            const px = Math.floor(cx + (Math.random() - 0.5) * baseRadius * 1.1);
            const py = Math.floor(cy + (Math.random() - 0.5) * baseRadius * 1.1);
            for (let j = 0; j < clusterSize; j++) {
                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * 2;
                const x = Math.floor(px + Math.cos(angle) * r);
                const y = Math.floor(py + Math.sin(angle) * r);
                if (x > 0 && x < MAP_WIDTH_TILES && y > 0 && y < MAP_HEIGHT_TILES && map[y][x].length > 1) {
                    map[y][x].push(type);
                }
            }
        }
    }
    placeResource(tileTypes.LARGE_TREE, 7, 3);
    placeResource(tileTypes.SMALL_TREE, 8, 2);
    placeResource(tileTypes.ROCK, 6, 2);
    placeResource(tileTypes.FLOWER, 6, 2);

    // Add resources to second island
    function placeResourceOnSecondIsland(type, count, clusterSize) {
        for (let i = 0; i < count; i++) {
            const px = Math.floor(secondIslandX + (Math.random() - 0.5) * secondIslandRadius * 1.1);
            const py = Math.floor(secondIslandY + (Math.random() - 0.5) * secondIslandRadius * 1.1);
            for (let j = 0; j < clusterSize; j++) {
                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * 2;
                const x = Math.floor(px + Math.cos(angle) * r);
                const y = Math.floor(py + Math.sin(angle) * r);
                if (x > 0 && x < MAP_WIDTH_TILES && y > 0 && y < MAP_HEIGHT_TILES && map[y][x].length > 1) {
                    map[y][x].push(type);
                }
            }
        }
    }
    placeResourceOnSecondIsland(tileTypes.LARGE_TREE, 3, 2);
    placeResourceOnSecondIsland(tileTypes.SMALL_TREE, 4, 2);
    placeResourceOnSecondIsland(tileTypes.ROCK, 2, 2);
    placeResourceOnSecondIsland(tileTypes.FLOWER, 3, 2);

    // Place farmhouse in the center (10x6)
    const fw = 10, fh = 6;
    const fx = Math.floor((MAP_WIDTH_TILES - fw) / 2);
    const fy = Math.floor((MAP_HEIGHT_TILES - fh) / 2);
    for (let y = fy; y < fy + fh; y++) {
        for (let x = fx; x < fx + fw; x++) {
            map[y][x].push(tileTypes.FARMHOUSE);
        }
    }
    farmhouse = { x: fx, y: fy, w: fw, h: fh };

    // Always use static chicken coop placement
    if (chickenCoop && chickenCoop.x !== undefined && chickenCoop.y !== undefined) {
        for (let y = chickenCoop.y; y < chickenCoop.y + chickenCoop.h; y++) {
            for (let x = chickenCoop.x; x < chickenCoop.x + chickenCoop.w; x++) {
                if (x >= 0 && y >= 0 && x < MAP_WIDTH_TILES && y < MAP_HEIGHT_TILES) {
                    map[y][x].push(tileTypes.FARMHOUSE); // treat as impassable
                }
            }
        }
    }

    // Always use static sign placement
    if (signObj && signObj.x !== undefined && signObj.y !== undefined) {
        for (let y = signObj.y; y < signObj.y + signObj.h; y++) {
            for (let x = signObj.x; x < signObj.x + signObj.w; x++) {
                if (x >= 0 && y >= 0 && x < MAP_WIDTH_TILES && y < MAP_HEIGHT_TILES) {
                    map[y][x].push(tileTypes.FARMHOUSE); // treat as impassable
                }
            }
        }
    }
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