// Procedural dirt tile generator
// Generates dirt tiles with edges on any combination of sides

// Dirt color palette (from Document Colors.gpl - colors from tile-dirt.gif)
const DIRT_COLORS = [
    '#BE783B',  // 190 120 59
    '#A76835',  // 167 104 53
    '#C07D3C',  // 192 125 60
    '#9A5C2C',  // 154 92 44
    '#B9773A',  // 185 119 58 - close to main color #BA6B3A
    '#AB6936',  // 171 105 54
    '#C5803D',  // 197 128 61
    '#AD6B38',  // 173 107 56
    '#97592C',  // 151 89 44
    '#B36E37',  // 179 110 55
    '#B67437',  // 182 116 55
    '#9F612F',  // 159 97 47
];

// Edge configuration flags (same as grass)
export const EDGE_NORTH = 1;
export const EDGE_SOUTH = 2;
export const EDGE_EAST = 4;
export const EDGE_WEST = 8;
export const CORNER_NE = 16;
export const CORNER_SE = 32;
export const CORNER_SW = 64;
export const CORNER_NW = 128;

// Cache for generated tiles
const tileCache = new Map();

// Seeded random number generator for consistent patterns
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// Generate a dirt pattern on a canvas
function generateDirtPattern(ctx, width, height, seed = 0) {
    const pixelSize = 2; // Size of each "pixel" in the pattern

    for (let y = 0; y < height; y += pixelSize) {
        for (let x = 0; x < width; x += pixelSize) {
            // Use position-based seed for consistent pattern
            const localSeed = seed + x * 1000 + y;
            const colorIndex = Math.floor(seededRandom(localSeed) * DIRT_COLORS.length);
            ctx.fillStyle = DIRT_COLORS[colorIndex];
            ctx.fillRect(x, y, pixelSize, pixelSize);
        }
    }
}

// Generate a dirt tile with specified edge configuration
// edgeFlags contains cardinal edges only (bits 0-3)
export function generateDirtTile(edgeFlags, tileSize = 32) {
    // Only use cardinal edge flags (mask out any corner flags)
    const cardinalFlags = edgeFlags & 0x0F;

    // Check cache first
    const cacheKey = `dirt-${cardinalFlags}-${tileSize}`;
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

    // Generate full dirt pattern first
    generateDirtPattern(ctx, tileSize, tileSize, cardinalFlags * 1000 + 500);

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
// This creates a concave cut into the dirt, showing water beneath
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
export function getDirtTileCanvas(edgeFlags, tileSize = 32) {
    const result = generateDirtTile(edgeFlags, tileSize);
    return result.canvas;
}

// Get edge flags for a DIRT tile based on which neighbors are water
// Only returns cardinal edge flags (diagonal parameters kept for API compatibility but ignored)
export function getDirtEdgeFlagsFromNeighbors(n, s, e, w, ne, se, sw, nw) {
    let flags = 0;

    // Cardinal edges - where water is adjacent
    if (n) flags |= EDGE_NORTH;
    if (s) flags |= EDGE_SOUTH;
    if (e) flags |= EDGE_EAST;
    if (w) flags |= EDGE_WEST;

    return flags;
}

// Clear the tile cache
export function clearDirtTileCache() {
    tileCache.clear();
}
