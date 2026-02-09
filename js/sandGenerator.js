// Procedural sand tile generator
// Generates sand tiles with edges on any combination of sides

// Sand color palette (from Document Colors.gpl - colors from tile-sand.gif)
const SAND_COLORS = [
    '#FFFF88',  // 255 255 136
    '#FFF07A',  // 255 240 122
    '#FFFF8A',  // 255 255 138
    '#FFD465',  // 255 212 101
    '#FFFF86',  // 255 255 134
    '#FFF27C',  // 255 242 124
    '#FFFF8D',  // 255 255 141
    '#FFCD65',  // 255 205 101
    '#FFF781',  // 255 247 129
    '#FFFD7F',  // 255 253 127
    '#FFFF7F',  // 255 255 127
    '#FFE06C',  // 255 224 108
];

// Edge configuration flags (same as grass/dirt)
export const EDGE_NORTH = 1;
export const EDGE_SOUTH = 2;
export const EDGE_EAST = 4;
export const EDGE_WEST = 8;

// Cache for generated tiles
const tileCache = new Map();

// Seeded random number generator for consistent patterns
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// Generate a sand pattern on a canvas
function generateSandPattern(ctx, width, height, seed = 0) {
    const pixelSize = 2; // Size of each "pixel" in the pattern

    for (let y = 0; y < height; y += pixelSize) {
        for (let x = 0; x < width; x += pixelSize) {
            // Use position-based seed for consistent pattern
            const localSeed = seed + x * 1000 + y;
            const colorIndex = Math.floor(seededRandom(localSeed) * SAND_COLORS.length);
            ctx.fillStyle = SAND_COLORS[colorIndex];
            ctx.fillRect(x, y, pixelSize, pixelSize);
        }
    }
}

// Generate a sand tile with specified edge configuration
// edgeFlags contains cardinal edges only (bits 0-3)
export function generateSandTile(edgeFlags, tileSize = 32) {
    // Only use cardinal edge flags (mask out any corner flags)
    const cardinalFlags = edgeFlags & 0x0F;

    // Check cache first
    const cacheKey = `sand-${cardinalFlags}-${tileSize}`;
    if (tileCache.has(cacheKey)) {
        return tileCache.get(cacheKey);
    }

    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d');

    // Determine which edges are exposed to water
    const hasN = (cardinalFlags & EDGE_NORTH) !== 0;
    const hasS = (cardinalFlags & EDGE_SOUTH) !== 0;
    const hasE = (cardinalFlags & EDGE_EAST) !== 0;
    const hasW = (cardinalFlags & EDGE_WEST) !== 0;

    // Generate full sand pattern first
    generateSandPattern(ctx, tileSize, tileSize, cardinalFlags * 1000 + 700);

    // Cut out edges and corners using clearRect
    const edgeDepth = Math.floor(tileSize * 0.12);
    const cornerRadius = Math.floor(tileSize * 0.28);

    // Cut jagged edges along exposed sides
    if (hasN) addJaggedEdge(ctx, 0, tileSize, tileSize, edgeDepth, 'north', cardinalFlags + 1000);
    if (hasS) addJaggedEdge(ctx, 0, tileSize, tileSize, edgeDepth, 'south', cardinalFlags + 2000);
    if (hasE) addJaggedEdgeVertical(ctx, tileSize, 0, tileSize, tileSize, edgeDepth, 'east', cardinalFlags + 3000);
    if (hasW) addJaggedEdgeVertical(ctx, 0, 0, tileSize, tileSize, edgeDepth, 'west', cardinalFlags + 4000);

    // Round the outside corners where two edges meet
    if (hasN && hasE) cutRoundedCorner(ctx, tileSize, 0, cornerRadius, 'ne', cardinalFlags + 100);
    if (hasS && hasE) cutRoundedCorner(ctx, tileSize, tileSize, cornerRadius, 'se', cardinalFlags + 200);
    if (hasS && hasW) cutRoundedCorner(ctx, 0, tileSize, cornerRadius, 'sw', cardinalFlags + 300);
    if (hasN && hasW) cutRoundedCorner(ctx, 0, 0, cornerRadius, 'nw', cardinalFlags + 400);

    // Cache the result
    const result = { canvas, dataUrl: null };
    tileCache.set(cacheKey, result);

    return result;
}

// Cut a rounded corner - removes pixels INSIDE the quarter-circle arc
function cutRoundedCorner(ctx, cornerX, cornerY, radius, direction, seed) {
    for (let i = 0; i <= radius + 2; i++) {
        for (let j = 0; j <= radius + 2; j++) {
            let px, py;

            switch (direction) {
                case 'ne':
                    px = cornerX - i - 1;
                    py = j;
                    break;
                case 'se':
                    px = cornerX - i - 1;
                    py = cornerY - j - 1;
                    break;
                case 'sw':
                    px = i;
                    py = cornerY - j - 1;
                    break;
                case 'nw':
                    px = i;
                    py = j;
                    break;
            }

            const dist = Math.sqrt(i * i + j * j);
            const noise = (seededRandom(seed + i * 37 + j * 53) - 0.5) * 3;

            if (dist < radius + noise) {
                ctx.clearRect(px, py, 1, 1);
            }
        }
    }
}

// Add jagged edge along a horizontal side
function addJaggedEdge(ctx, startX, endX, tileSize, maxDepth, direction, seed) {
    for (let x = Math.floor(startX); x < Math.floor(endX); x++) {
        const rand = seededRandom(seed + x * 13);

        let depth;
        if (rand < 0.15) {
            depth = Math.floor(maxDepth * 0.8 + seededRandom(seed + x * 31) * maxDepth * 0.5);
        } else if (rand < 0.4) {
            depth = Math.floor(maxDepth * 0.4 + seededRandom(seed + x * 17) * maxDepth * 0.3);
        } else {
            depth = Math.floor(1 + seededRandom(seed + x * 23) * maxDepth * 0.25);
        }

        if (direction === 'north') {
            ctx.clearRect(x, 0, 1, depth);
        } else {
            ctx.clearRect(x, tileSize - depth, 1, depth);
        }
    }
}

// Add jagged edge along a vertical side
function addJaggedEdgeVertical(ctx, x, startY, endY, tileSize, maxDepth, direction, seed) {
    for (let y = Math.floor(startY); y < Math.floor(endY); y++) {
        const rand = seededRandom(seed + y * 13);

        let depth;
        if (rand < 0.15) {
            depth = Math.floor(maxDepth * 0.8 + seededRandom(seed + y * 31) * maxDepth * 0.5);
        } else if (rand < 0.4) {
            depth = Math.floor(maxDepth * 0.4 + seededRandom(seed + y * 17) * maxDepth * 0.3);
        } else {
            depth = Math.floor(1 + seededRandom(seed + y * 23) * maxDepth * 0.25);
        }

        if (direction === 'east') {
            ctx.clearRect(tileSize - depth, y, depth, 1);
        } else {
            ctx.clearRect(0, y, depth, 1);
        }
    }
}

// Get just the canvas for direct rendering
export function getSandTileCanvas(edgeFlags, tileSize = 32) {
    const result = generateSandTile(edgeFlags, tileSize);
    return result.canvas;
}

// Get edge flags for a SAND tile based on which neighbors are water
// Only returns cardinal edge flags (diagonal parameters kept for API compatibility but ignored)
export function getSandEdgeFlagsFromNeighbors(n, s, e, w, ne, se, sw, nw) {
    let flags = 0;

    // Cardinal edges - where water is adjacent
    if (n) flags |= EDGE_NORTH;
    if (s) flags |= EDGE_SOUTH;
    if (e) flags |= EDGE_EAST;
    if (w) flags |= EDGE_WEST;

    return flags;
}

// Clear the tile cache
export function clearSandTileCache() {
    tileCache.clear();
}
