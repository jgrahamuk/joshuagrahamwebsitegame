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

export let map = [];
export let MAP_WIDTH_TILES = 64;
export let MAP_HEIGHT_TILES = 48;
export let farmhouse = null; // {x, y, w, h}
export let chickenCoop = null; // {x, y, w, h}
export let signObj = null; // {x, y, w, h}

export function initializeMap() {
    map.length = 0; // clear any previous map
    const cx = MAP_WIDTH_TILES / 2;
    const cy = MAP_HEIGHT_TILES / 2;
    const baseRadius = Math.min(MAP_WIDTH_TILES, MAP_HEIGHT_TILES) / 2.3;
    const noise = (x, y) => 0.7 + 0.3 * Math.sin(x * 0.4) * Math.cos(y * 0.3 + x * 0.1);

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
            // Main island
            if (dist < baseRadius * n) {
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

    // Place chicken coop (5x3) in the top-left part of the island, fully on grass/dirt, not overlapping farmhouse or water
    const cw = 5, ch = 3;
    let coopPlaced = false;
    for (let y0 = 1; y0 < Math.floor(MAP_HEIGHT_TILES / 2) && !coopPlaced; y0++) {
        for (let x0 = 1; x0 < Math.floor(MAP_WIDTH_TILES / 2) && !coopPlaced; x0++) {
            let ok = true;
            for (let y = y0; y < y0 + ch && ok; y++) {
                for (let x = x0; x < x0 + cw && ok; x++) {
                    const top = map[y][x][map[y][x].length - 1];
                    if (top !== tileTypes.GRASS && top !== tileTypes.DIRT) ok = false;
                    // Don't overlap farmhouse
                    if (x >= fx && x < fx + fw && y >= fy && y < fy + fh) ok = false;
                }
            }
            if (ok) {
                for (let y = y0; y < y0 + ch; y++) {
                    for (let x = x0; x < x0 + cw; x++) {
                        map[y][x].push(tileTypes.FARMHOUSE); // treat as impassable
                    }
                }
                chickenCoop = { x: x0, y: y0, w: cw, h: ch };
                coopPlaced = true;
            }
        }
    }

    // Place sign (5x3) in the top-right part of the island, fully on grass/dirt, not overlapping water, farmhouse, or chicken coop
    let signPlaced = false;
    for (let y0 = 1; y0 < Math.floor(MAP_HEIGHT_TILES / 2) && !signPlaced; y0++) {
        for (let x0 = Math.floor(MAP_WIDTH_TILES / 2); x0 < MAP_WIDTH_TILES - cw - 1 && !signPlaced; x0++) {
            let ok = true;
            for (let y = y0; y < y0 + ch && ok; y++) {
                for (let x = x0; x < x0 + cw && ok; x++) {
                    const top = map[y][x][map[y][x].length - 1];
                    if (top !== tileTypes.GRASS && top !== tileTypes.DIRT) ok = false;
                    // Don't overlap farmhouse
                    if (x >= fx && x < fx + fw && y >= fy && y < fy + fh) ok = false;
                    // Don't overlap chicken coop
                    if (chickenCoop && x >= chickenCoop.x && x < chickenCoop.x + chickenCoop.w && y >= chickenCoop.y && y < chickenCoop.y + chickenCoop.h) ok = false;
                }
            }
            if (ok) {
                for (let y = y0; y < y0 + ch; y++) {
                    for (let x = x0; x < x0 + cw; x++) {
                        map[y][x].push(tileTypes.FARMHOUSE); // treat as impassable
                    }
                }
                signObj = { x: x0, y: y0, w: cw, h: ch };
                signPlaced = true;
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