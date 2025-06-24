const fs = require('fs');
const path = require('path');

// Tile types
const tileTypes = {
    WATER: 'WATER',
    WATER_BORDER: 'WATER_BORDER',
    GRASS: 'GRASS',
    DIRT: 'DIRT',
    ROCK: 'ROCK',
    FLOWER: 'FLOWER',
    SMALL_TREE: 'SMALL_TREE',
    LARGE_TREE: 'LARGE_TREE'
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

    // Generate landscape map
    const landscapeMap = {
        width: 96,
        height: 48,
        tiles: generateMapData(96, 48, true),
        structures: [
            {
                type: "FARMHOUSE",
                x: 40,
                y: 20,
                width: 8,
                height: 6
            },
            {
                type: "CHICKEN_COOP",
                x: 60,
                y: 25,
                width: 5,
                height: 3
            },
            {
                type: "SIGN",
                x: 75,
                y: 15,
                width: 12,
                height: 8
            }
        ],
        resources: generateResources(96, 48, true),
        npcs: [
            {
                name: "Joshua",
                x: 55,
                y: 22,
                message: "Welcome to my farm! How are you today?"
            }
        ],
        chickens: [
            { x: 62, y: 26 },
            { x: 63, y: 27 },
            { x: 61, y: 27 }
        ]
    };

    // Generate portrait map
    const portraitMap = {
        width: 48,
        height: 72,
        tiles: generateMapData(48, 72, false),
        structures: [
            {
                type: "FARMHOUSE",
                x: 20,
                y: 30,
                width: 6,
                height: 8
            },
            {
                type: "CHICKEN_COOP",
                x: 25,
                y: 45,
                width: 3,
                height: 5
            },
            {
                type: "SIGN",
                x: 15,
                y: 55,
                width: 8,
                height: 12
            }
        ],
        resources: generateResources(48, 72, false),
        npcs: [
            {
                name: "Joshua",
                x: 22,
                y: 40,
                message: "Welcome to my farm! How are you today?"
            }
        ],
        chickens: [
            { x: 26, y: 46 },
            { x: 27, y: 47 },
            { x: 27, y: 46 }
        ]
    };

    // Write files
    fs.writeFileSync(
        path.join(mapsDir, 'landscape.json'),
        JSON.stringify(landscapeMap, null, 2)
    );

    fs.writeFileSync(
        path.join(mapsDir, 'portrait.json'),
        JSON.stringify(portraitMap, null, 2)
    );

    console.log('Map files generated successfully!');
    console.log(`Landscape map: ${landscapeMap.tiles.length} tiles`);
    console.log(`Portrait map: ${portraitMap.tiles.length} tiles`);
}

generateMaps(); 