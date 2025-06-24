const fs = require('fs');
const path = require('path');

// Tile types
const tileTypes = {
    WATER: { color: 'blue', passable: false, resource: null },
    WATER_BORDER: 'WATER_BORDER',
    GRASS: { color: 'green', passable: true, resource: null },
    DIRT: { color: 'brown', passable: true, resource: null },
    ROCK: { color: 'grey', passable: false, resource: 'stone' },
    FLOWER: { color: 'pink', passable: true, resource: null },
    SMALL_TREE: { color: 'darkgreen', passable: false, resource: 'wood' },
    LARGE_TREE: { color: 'darkgreen', passable: false, resource: 'wood' },
    EGG: { color: 'white', passable: true, resource: 'egg' },
    BADGE: { color: 'gold', passable: true, resource: 'badge' },
    FARMHOUSE: { color: 'white', passable: false, resource: null },
    CHICKEN_COOP: 'CHICKEN_COOP',
    SIGN: 'SIGN'
};

function generateMapData(width, height, isLandscape) {
    const cx = width / 2;
    const cy = height / 2;

    // Calculate island size to leave proper water margins
    // For landscape, we need more water at top/bottom
    // For portrait, we need more water at left/right
    let waterMarginX, waterMarginY;
    if (isLandscape) {
        waterMarginX = 2; // Less water on sides
        waterMarginY = 8; // More water on top/bottom
    } else {
        waterMarginX = 8; // More water on left/right
        waterMarginY = 2; // Less water on top/bottom
    }

    const maxIslandWidth = width - (waterMarginX * 2);
    const maxIslandHeight = height - (waterMarginY * 2);

    // Calculate base radius based on screen orientation
    let baseRadius;
    if (isLandscape) {
        // For landscape, use the smaller dimension to ensure proper margins
        baseRadius = Math.min(maxIslandWidth / 1.1, maxIslandHeight / 0.8) / 2;
    } else {
        // For portrait, use the smaller dimension to ensure proper margins
        baseRadius = Math.min(maxIslandWidth / 0.8, maxIslandHeight / 1.1) / 2;
    }

    const noise = (x, y) => 0.8 + 0.25 * Math.sin(x * 0.4) * Math.cos(y * 0.3 + x * 0.1);

    const tiles = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const layers = [];

            // Base water layer
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const n = noise(x, y);

            // Rippling water border
            if (dist < baseRadius * n * 1.08 && dist > baseRadius * n * 0.98) {
                layers.push(tileTypes.WATER_BORDER);
            } else {
                layers.push(tileTypes.WATER);
            }

            // Main island
            if (isLandscape) {
                const ellipticalDist = Math.sqrt((dx * dx) / 1.1 + (dy * dy) / 0.8);
                if (ellipticalDist < baseRadius * n) {
                    layers.push(tileTypes.GRASS);
                }
            } else {
                const ellipticalDist = Math.sqrt((dx * dx) / 0.8 + (dy * dy) / 1.1);
                if (ellipticalDist < baseRadius * n) {
                    layers.push(tileTypes.GRASS);
                }
            }

            if (layers.length > 1) {
                tiles.push({ x, y, layers });
            }
        }
    }

    return tiles;
}

function generateResources(width, height, isLandscape) {
    const cx = width / 2;
    const cy = height / 2;
    const baseRadius = Math.min(width, height) / 3;

    const resources = [];

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
                if (x > 0 && x < width && y > 0 && y < height) {
                    resources.push({ type, x, y });
                }
            }
        }
    }

    placeResource(tileTypes.LARGE_TREE, 7, 3);
    placeResource(tileTypes.SMALL_TREE, 8, 2);
    placeResource(tileTypes.ROCK, 6, 2);
    placeResource(tileTypes.FLOWER, 6, 2);

    return resources;
}

function generateMaps() {
    // Create maps directory if it doesn't exist
    const mapsDir = path.join(__dirname, 'maps');
    if (!fs.existsSync(mapsDir)) {
        fs.mkdirSync(mapsDir);
    }

    // Create a single map with 16:9 aspect ratio (60x34 tiles)
    // This will be used for both landscape and portrait (transposed)
    function generateMap() {
        const width = 60;
        const height = 34;

        // Initialize map with water
        const map = [];
        for (let y = 0; y < height; y++) {
            map[y] = [];
            for (let x = 0; x < width; x++) {
                map[y][x] = [tileTypes.WATER];
            }
        }

        // Create island shape - centered with organic borders
        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);
        const maxRadius = Math.min(width, height) / 2 - 2;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                const noise = Math.sin(x * 0.3) * Math.cos(y * 0.3) * 2;

                if (distance < maxRadius + noise) {
                    // Determine tile type based on distance and noise
                    if (distance < maxRadius - 3 + noise) {
                        // Inner area - mostly grass with some dirt
                        map[y][x] = [tileTypes.WATER, Math.random() < 0.8 ? tileTypes.GRASS : tileTypes.DIRT];
                    } else {
                        // Border area - mix of grass and water
                        map[y][x] = [tileTypes.WATER, Math.random() < 0.6 ? tileTypes.GRASS : tileTypes.WATER];
                    }
                }
            }
        }

        // Add some water border tiles for visual appeal
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (map[y][x].includes(tileTypes.GRASS)) {
                    // Check if this grass tile is near water
                    let nearWater = false;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const ny = y + dy;
                            const nx = x + dx;
                            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                                if (!map[ny][nx].includes(tileTypes.GRASS)) {
                                    nearWater = true;
                                    break;
                                }
                            }
                        }
                        if (nearWater) break;
                    }
                    if (nearWater && Math.random() < 0.3) {
                        map[y][x].push({ ...tileTypes.WATER, color: '#3bbcff' }); // Water border
                    }
                }
            }
        }

        // Add resources
        const resources = [];

        // Add trees (increased by 25%)
        for (let i = 0; i < 19; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            if (map[y][x].includes(tileTypes.GRASS) && !map[y][x].some(t => t.resource)) {
                const treeType = Math.random() < 0.6 ? 'LARGE_TREE' : 'SMALL_TREE';
                resources.push({ type: treeType, x, y });
                map[y][x].push(treeType === 'LARGE_TREE' ? tileTypes.LARGE_TREE : tileTypes.SMALL_TREE);
            }
        }

        // Add rocks (increased by 25%)
        for (let i = 0; i < 10; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            if (map[y][x].includes(tileTypes.GRASS) && !map[y][x].some(t => t.resource)) {
                resources.push({ type: 'ROCK', x, y });
                map[y][x].push(tileTypes.ROCK);
            }
        }

        // Add flowers (increased by 25%)
        for (let i = 0; i < 6; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            if (map[y][x].includes(tileTypes.GRASS) && !map[y][x].some(t => t.resource)) {
                resources.push({ type: 'FLOWER', x, y });
                map[y][x].push(tileTypes.FLOWER);
            }
        }

        // Add eggs (increased by 25%)
        for (let i = 0; i < 4; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            if (map[y][x].includes(tileTypes.GRASS) && !map[y][x].some(t => t.resource)) {
                resources.push({ type: 'EGG', x, y });
                map[y][x].push(tileTypes.EGG);
            }
        }

        // Add badges (increased by 25%)
        for (let i = 0; i < 3; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            if (map[y][x].includes(tileTypes.GRASS) && !map[y][x].some(t => t.resource)) {
                resources.push({ type: 'BADGE', x, y });
                map[y][x].push(tileTypes.BADGE);
            }
        }

        // Convert map to tile format
        const tiles = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const layers = map[y][x].map(tile => {
                    if (tile === tileTypes.WATER) return 'WATER';
                    if (tile === tileTypes.GRASS) return 'GRASS';
                    if (tile === tileTypes.DIRT) return 'DIRT';
                    if (tile.color === '#3bbcff') return 'WATER_BORDER';
                    if (tile === tileTypes.LARGE_TREE) return 'LARGE_TREE';
                    if (tile === tileTypes.SMALL_TREE) return 'SMALL_TREE';
                    if (tile === tileTypes.ROCK) return 'ROCK';
                    if (tile === tileTypes.FLOWER) return 'FLOWER';
                    if (tile === tileTypes.EGG) return 'EGG';
                    if (tile === tileTypes.BADGE) return 'BADGE';
                    return 'WATER';
                });
                tiles.push({ x, y, layers });
            }
        }

        // Add structures (adjusted for new size)
        const structures = [
            {
                type: 'FARMHOUSE',
                x: 25,
                y: 15,
                width: 5,
                height: 4
            },
            {
                type: 'CHICKEN_COOP',
                x: 11,
                y: 9,
                width: 4,
                height: 3
            },
            {
                type: 'SIGN',
                x: 44,
                y: 5,
                width: 8,
                height: 4
            }
        ];

        // Add NPCs (adjusted for new size)
        const npcs = [
            {
                name: 'Joshua',
                x: 30,
                y: 16,
                message: 'Welcome to my farm! It looks like the chickens are having a great time.'
            }
        ];

        // Add chickens (adjusted for new size)
        const chickens = [
            { x: 16, y: 9 },
            { x: 24, y: 9 },
            { x: 20, y: 14 }
        ];

        return {
            width,
            height,
            tiles,
            structures,
            resources,
            npcs,
            chickens
        };
    }

    // Generate the map
    const mapData = generateMap();

    // Save to a single map file
    fs.writeFileSync(
        path.join(mapsDir, 'map.json'),
        JSON.stringify(mapData, null, 2)
    );

    console.log('Generated single map with dimensions:', mapData.width, 'x', mapData.height);
    console.log('Map saved to maps/map.json');
}

generateMaps(); 