// Procedural grass tile generator
// Generates grass tiles with edges on any combination of sides

// Grass color palette (from Document Colors.gpl - exact colors from tile-grass.gif)
const GRASS_COLORS = [
    '#448F24',  // 68 143 36 - Dark
    '#469324',  // 70 147 36 - Dark
    '#4A9524',  // 74 149 36 - Dark-medium
    '#529D25',  // 82 157 37 - Medium
    '#55A126',  // 85 161 38 - Medium
    '#5AA426',  // 90 164 38 - Medium
    '#5EA826',  // 94 168 38 - Medium
    '#63AB27',  // 99 171 39 - Medium-light
    '#6BB228',  // 107 178 40 - Medium-light
    '#72B629',  // 114 182 41 - Light
    '#75B929',  // 117 185 41 - Light
    '#7BBC2A',  // 123 188 42 - Lighter
];

// Edge configuration flags
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

// Generate a grass pattern on a canvas
function generateGrassPattern(ctx, width, height, seed = 0) {
    const pixelSize = 2; // Size of each "pixel" in the pattern

    for (let y = 0; y < height; y += pixelSize) {
        for (let x = 0; x < width; x += pixelSize) {
            // Use position-based seed for consistent pattern
            const localSeed = seed + x * 1000 + y;
            const colorIndex = Math.floor(seededRandom(localSeed) * GRASS_COLORS.length);
            ctx.fillStyle = GRASS_COLORS[colorIndex];
            ctx.fillRect(x, y, pixelSize, pixelSize);
        }
    }
}

// Generate jagged edge mask with smoother, more organic curves
// Returns an array of y-offsets for each x position (for horizontal edges)
// or x-offsets for each y position (for vertical edges)
function generateJaggedEdge(length, maxDepth, seed) {
    const edge = [];
    const minDepth = 2; // Minimum edge depth

    // Use multiple sine waves for organic look
    for (let i = 0; i < length; i++) {
        // Base wave pattern
        const wave1 = Math.sin(i * 0.3 + seededRandom(seed) * 10) * 0.3;
        const wave2 = Math.sin(i * 0.15 + seededRandom(seed + 1) * 10) * 0.4;
        const wave3 = Math.sin(i * 0.5 + seededRandom(seed + 2) * 10) * 0.2;

        // Combine waves and add small random noise
        const noise = (seededRandom(seed + i * 7) - 0.5) * 0.3;
        const combined = (wave1 + wave2 + wave3 + noise + 1) / 2; // Normalize to 0-1

        const depth = Math.floor(minDepth + combined * (maxDepth - minDepth));
        edge.push(Math.max(minDepth, Math.min(maxDepth, depth)));
    }

    return edge;
}

// Generate a grass tile with specified edge configuration
// Returns an object with both the canvas and data URL for flexibility
// edgeFlags contains both cardinal edges (bits 0-3) and inside corner preservation (bits 4-7)
export function generateGrassTile(edgeFlags, tileSize = 32) {
    // Check cache first
    const cacheKey = `${edgeFlags}-${tileSize}`;
    if (tileCache.has(cacheKey)) {
        return tileCache.get(cacheKey);
    }

    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d');

    // Determine which edges are exposed to water/dirt
    const hasN = (edgeFlags & EDGE_NORTH) !== 0;
    const hasS = (edgeFlags & EDGE_SOUTH) !== 0;
    const hasE = (edgeFlags & EDGE_EAST) !== 0;
    const hasW = (edgeFlags & EDGE_WEST) !== 0;

    // Determine which inside corners to preserve (don't cut edges there)
    // These are set when there's grass diagonally adjacent
    const preserveNE = (edgeFlags & CORNER_NE) !== 0;
    const preserveSE = (edgeFlags & CORNER_SE) !== 0;
    const preserveSW = (edgeFlags & CORNER_SW) !== 0;
    const preserveNW = (edgeFlags & CORNER_NW) !== 0;

    // Generate full grass pattern first
    generateGrassPattern(ctx, tileSize, tileSize, edgeFlags * 1000);

    // Cut out edges and corners using clearRect
    const edgeDepth = Math.floor(tileSize * 0.12);
    const cornerRadius = Math.floor(tileSize * 0.28);
    const preserveSize = edgeDepth + 2; // Size of corner area to preserve for inside corners

    // Cut jagged edges along exposed sides, but skip preserved inside corners
    if (hasN) {
        const startX = preserveNW ? preserveSize : 0;
        const endX = preserveNE ? tileSize - preserveSize : tileSize;
        if (startX < endX) addJaggedEdge(ctx, startX, endX, tileSize, edgeDepth, 'north', edgeFlags + 1000);
    }
    if (hasS) {
        const startX = preserveSW ? preserveSize : 0;
        const endX = preserveSE ? tileSize - preserveSize : tileSize;
        if (startX < endX) addJaggedEdge(ctx, startX, endX, tileSize, edgeDepth, 'south', edgeFlags + 2000);
    }
    if (hasE) {
        const startY = preserveNE ? preserveSize : 0;
        const endY = preserveSE ? tileSize - preserveSize : tileSize;
        if (startY < endY) addJaggedEdgeVertical(ctx, tileSize, startY, endY, tileSize, edgeDepth, 'east', edgeFlags + 3000);
    }
    if (hasW) {
        const startY = preserveNW ? preserveSize : 0;
        const endY = preserveSW ? tileSize - preserveSize : tileSize;
        if (startY < endY) addJaggedEdgeVertical(ctx, 0, startY, endY, tileSize, edgeDepth, 'west', edgeFlags + 4000);
    }

    // Round the outside corners where two edges meet (only if both edges exist and corner isn't preserved)
    if (hasN && hasE && !preserveNE) cutRoundedCorner(ctx, tileSize, 0, cornerRadius, 'ne', edgeFlags + 100);
    if (hasS && hasE && !preserveSE) cutRoundedCorner(ctx, tileSize, tileSize, cornerRadius, 'se', edgeFlags + 200);
    if (hasS && hasW && !preserveSW) cutRoundedCorner(ctx, 0, tileSize, cornerRadius, 'sw', edgeFlags + 300);
    if (hasN && hasW && !preserveNW) cutRoundedCorner(ctx, 0, 0, cornerRadius, 'nw', edgeFlags + 400);

    // Cache the result
    const result = { canvas, dataUrl: null };
    tileCache.set(cacheKey, result);

    return result;
}

// Cut a rounded corner - removes pixels INSIDE the quarter-circle arc
// This creates a concave cut into the grass, showing water beneath
function cutRoundedCorner(ctx, cornerX, cornerY, radius, direction, seed) {
    // We want to cut a quarter-circle out of the grass at the corner
    // so water shows through in a rounded shape
    for (let i = 0; i <= radius + 2; i++) {
        for (let j = 0; j <= radius + 2; j++) {
            let px, py;

            // Calculate pixel position based on which corner
            switch (direction) {
                case 'ne': // Top-right corner
                    px = cornerX - i - 1;
                    py = j;
                    break;
                case 'se': // Bottom-right corner
                    px = cornerX - i - 1;
                    py = cornerY - j - 1;
                    break;
                case 'sw': // Bottom-left corner
                    px = i;
                    py = cornerY - j - 1;
                    break;
                case 'nw': // Top-left corner
                    px = i;
                    py = j;
                    break;
            }

            // Distance from the corner point
            const dist = Math.sqrt(i * i + j * j);

            // Add noise for jagged effect
            const noise = (seededRandom(seed + i * 37 + j * 53) - 0.5) * 3;

            // Cut pixels that are INSIDE the radius (near the corner)
            // This creates a concave cut showing water beneath
            if (dist < radius + noise) {
                ctx.clearRect(px, py, 1, 1);
            }
        }
    }
}

// Add jagged edge along a horizontal side - spiky like grass/hair
function addJaggedEdge(ctx, startX, endX, tileSize, maxDepth, direction, seed) {
    for (let x = Math.floor(startX); x < Math.floor(endX); x++) {
        // Random spiky pattern
        const rand = seededRandom(seed + x * 13);

        // Base depth with high variation
        let depth;
        if (rand < 0.15) {
            // Occasional deep spike (hair/grass blade)
            depth = Math.floor(maxDepth * 0.8 + seededRandom(seed + x * 31) * maxDepth * 0.5);
        } else if (rand < 0.4) {
            // Medium depth
            depth = Math.floor(maxDepth * 0.4 + seededRandom(seed + x * 17) * maxDepth * 0.3);
        } else {
            // Shallow - creates the gaps between spikes
            depth = Math.floor(1 + seededRandom(seed + x * 23) * maxDepth * 0.25);
        }

        if (direction === 'north') {
            ctx.clearRect(x, 0, 1, depth);
        } else {
            ctx.clearRect(x, tileSize - depth, 1, depth);
        }
    }
}

// Add jagged edge along a vertical side - spiky like grass/hair
function addJaggedEdgeVertical(ctx, x, startY, endY, tileSize, maxDepth, direction, seed) {
    for (let y = Math.floor(startY); y < Math.floor(endY); y++) {
        // Random spiky pattern
        const rand = seededRandom(seed + y * 13);

        // Base depth with high variation
        let depth;
        if (rand < 0.15) {
            // Occasional deep spike
            depth = Math.floor(maxDepth * 0.8 + seededRandom(seed + y * 31) * maxDepth * 0.5);
        } else if (rand < 0.4) {
            // Medium depth
            depth = Math.floor(maxDepth * 0.4 + seededRandom(seed + y * 17) * maxDepth * 0.3);
        } else {
            // Shallow
            depth = Math.floor(1 + seededRandom(seed + y * 23) * maxDepth * 0.25);
        }

        if (direction === 'east') {
            ctx.clearRect(tileSize - depth, y, depth, 1);
        } else {
            ctx.clearRect(0, y, depth, 1);
        }
    }
}

// Generate an inside corner tile - an L-shaped grass piece with curved inner edge
// This is placed on WATER tiles where diagonal grass creates an inside corner
// It fills the gaps left by the jagged edges of adjacent grass tiles
export function generateInsideCornerTile(cornerDirection, tileSize = 32) {
    const cacheKey = `inside-${cornerDirection}-${tileSize}`;
    if (tileCache.has(cacheKey)) {
        return tileCache.get(cacheKey);
    }

    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d');

    // Match the edge depth from grass tile generation
    const edgeDepth = Math.floor(tileSize * 0.12);
    // Inner curve radius for the L-shape
    const innerRadius = Math.floor(tileSize * 0.10);
    const seed = cornerDirection.charCodeAt(0) * 1000;

    // Generate grass pattern first
    generateGrassPattern(ctx, tileSize, tileSize, cornerDirection.charCodeAt(0) * 5000);

    // Now cut away everything except the L-shaped corner piece
    // We'll iterate through every pixel and clear those outside the L-shape
    for (let y = 0; y < tileSize; y++) {
        for (let x = 0; x < tileSize; x++) {
            let inShape = false;

            // Calculate position relative to corner and edges
            let edgeDistX, edgeDistY, cornerDistX, cornerDistY;

            switch (cornerDirection) {
                case 'ne': // Top-right corner - grass along top and right edges
                    edgeDistX = tileSize - 1 - x; // Distance from right edge
                    edgeDistY = y;                 // Distance from top edge
                    cornerDistX = tileSize - 1 - x;
                    cornerDistY = y;
                    // In the L-shape if near top edge OR near right edge
                    if (edgeDistY < edgeDepth || edgeDistX < edgeDepth) {
                        inShape = true;
                        // But cut out the inner corner curve
                        if (edgeDistY >= edgeDepth - innerRadius && edgeDistX >= edgeDepth - innerRadius) {
                            const dx = edgeDistX - (edgeDepth - 1);
                            const dy = edgeDistY - (edgeDepth - 1);
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            const noise = (seededRandom(seed + x * 41 + y * 67) - 0.5) * 2;
                            if (dist > innerRadius + noise) {
                                inShape = false;
                            }
                        }
                    }
                    break;

                case 'se': // Bottom-right corner - grass along bottom and right edges
                    edgeDistX = tileSize - 1 - x; // Distance from right edge
                    edgeDistY = tileSize - 1 - y; // Distance from bottom edge
                    if (edgeDistY < edgeDepth || edgeDistX < edgeDepth) {
                        inShape = true;
                        if (edgeDistY >= edgeDepth - innerRadius && edgeDistX >= edgeDepth - innerRadius) {
                            const dx = edgeDistX - (edgeDepth - 1);
                            const dy = edgeDistY - (edgeDepth - 1);
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            const noise = (seededRandom(seed + x * 41 + y * 67) - 0.5) * 2;
                            if (dist > innerRadius + noise) {
                                inShape = false;
                            }
                        }
                    }
                    break;

                case 'sw': // Bottom-left corner - grass along bottom and left edges
                    edgeDistX = x;                 // Distance from left edge
                    edgeDistY = tileSize - 1 - y; // Distance from bottom edge
                    if (edgeDistY < edgeDepth || edgeDistX < edgeDepth) {
                        inShape = true;
                        if (edgeDistY >= edgeDepth - innerRadius && edgeDistX >= edgeDepth - innerRadius) {
                            const dx = edgeDistX - (edgeDepth - 1);
                            const dy = edgeDistY - (edgeDepth - 1);
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            const noise = (seededRandom(seed + x * 41 + y * 67) - 0.5) * 2;
                            if (dist > innerRadius + noise) {
                                inShape = false;
                            }
                        }
                    }
                    break;

                case 'nw': // Top-left corner - grass along top and left edges
                    edgeDistX = x;  // Distance from left edge
                    edgeDistY = y;  // Distance from top edge
                    if (edgeDistY < edgeDepth || edgeDistX < edgeDepth) {
                        inShape = true;
                        if (edgeDistY >= edgeDepth - innerRadius && edgeDistX >= edgeDepth - innerRadius) {
                            const dx = edgeDistX - (edgeDepth - 1);
                            const dy = edgeDistY - (edgeDepth - 1);
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            const noise = (seededRandom(seed + x * 41 + y * 67) - 0.5) * 2;
                            if (dist > innerRadius + noise) {
                                inShape = false;
                            }
                        }
                    }
                    break;
            }

            if (!inShape) {
                ctx.clearRect(x, y, 1, 1);
            }
        }
    }

    const result = { canvas, dataUrl: null };
    tileCache.set(cacheKey, result);
    return result;
}

// Get inside corner canvas for direct rendering
export function getInsideCornerCanvas(cornerDirection, tileSize = 32) {
    return generateInsideCornerTile(cornerDirection, tileSize).canvas;
}

// Get just the canvas for direct rendering (more efficient)
export function getGrassTileCanvas(edgeFlags, tileSize = 32) {
    const result = generateGrassTile(edgeFlags, tileSize);
    return result.canvas;
}

// Get edge flags from neighbor configuration
// Get edge flags for a GRASS tile based on which neighbors are water/dirt
export function getEdgeFlagsFromNeighbors(n, s, e, w, ne, se, sw, nw) {
    let flags = 0;

    // Cardinal edges - where water/dirt is adjacent
    if (n) flags |= EDGE_NORTH;
    if (s) flags |= EDGE_SOUTH;
    if (e) flags |= EDGE_EAST;
    if (w) flags |= EDGE_WEST;

    // Inside corner preservation - don't cut edges where grass meets diagonally
    // An inside corner exists when: one cardinal has water, perpendicular has grass, diagonal has water
    // NE: (north edge OR east edge, but not both) AND water diagonal
    if (((n && !e) || (e && !n)) && ne) flags |= CORNER_NE;
    // SE: (south edge OR east edge, but not both) AND water diagonal
    if (((s && !e) || (e && !s)) && se) flags |= CORNER_SE;
    // SW: (south edge OR west edge, but not both) AND water diagonal
    if (((s && !w) || (w && !s)) && sw) flags |= CORNER_SW;
    // NW: (north edge OR west edge, but not both) AND water diagonal
    if (((n && !w) || (w && !n)) && nw) flags |= CORNER_NW;

    return flags;
}

// Get inside corner flags for a WATER/DIRT tile based on which neighbors are grass
// Returns which corners need grass quarter-circles
export function getInsideCornerFlags(n, s, e, w) {
    let flags = 0;

    // If two adjacent cardinal directions have grass, we need an inside corner
    // between them (on this water tile)
    if (n && e) flags |= CORNER_NE;  // Grass to N and E = corner in NE
    if (s && e) flags |= CORNER_SE;  // Grass to S and E = corner in SE
    if (s && w) flags |= CORNER_SW;  // Grass to S and W = corner in SW
    if (n && w) flags |= CORNER_NW;  // Grass to N and W = corner in NW

    return flags;
}

// Clear the tile cache (call when tile size changes)
export function clearGrassTileCache() {
    tileCache.clear();
}

// Pre-generate common tile configurations
export function pregenerateCommonTiles(tileSize = 32) {
    // Generate all single-edge tiles
    generateGrassTile(EDGE_NORTH, tileSize);
    generateGrassTile(EDGE_SOUTH, tileSize);
    generateGrassTile(EDGE_EAST, tileSize);
    generateGrassTile(EDGE_WEST, tileSize);

    // Generate all corner tiles (two adjacent edges)
    generateGrassTile(EDGE_NORTH | EDGE_EAST, tileSize);
    generateGrassTile(EDGE_SOUTH | EDGE_EAST, tileSize);
    generateGrassTile(EDGE_SOUTH | EDGE_WEST, tileSize);
    generateGrassTile(EDGE_NORTH | EDGE_WEST, tileSize);

    // Generate inside corner tiles
    generateGrassTile(CORNER_NE, tileSize);
    generateGrassTile(CORNER_SE, tileSize);
    generateGrassTile(CORNER_SW, tileSize);
    generateGrassTile(CORNER_NW, tileSize);

    // Generate no-edge tile (plain grass)
    generateGrassTile(0, tileSize);
}
