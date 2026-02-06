import { tileTypes } from './map.js';

// Map generation and tile helpers
function generateMapData(width, height, isLandscape) {
    const cx = width / 2;
    const cy = height / 2;

    // Calculate aspect ratio to determine island shape
    const aspectRatio = width / height;

    // Calculate island size to leave 1-2 tiles of water on each side
    const waterMargin = 1.5;
    const maxIslandWidth = width - (waterMargin * 2);
    const maxIslandHeight = height - (waterMargin * 2);

    // Calculate base radius based on screen orientation
    let baseRadius;
    if (isLandscape) {
        baseRadius = Math.min(maxIslandWidth / 1.1, maxIslandHeight / 0.8) / 2;
    } else {
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
                layers.push("WATER_BORDER");
            } else {
                layers.push("WATER");
            }

            // Main island
            if (isLandscape) {
                const ellipticalDist = Math.sqrt((dx * dx) / 1.1 + (dy * dy) / 0.8);
                if (ellipticalDist < baseRadius * n) {
                    layers.push("GRASS");
                }
            } else {
                const ellipticalDist = Math.sqrt((dx * dx) / 0.8 + (dy * dy) / 1.1);
                if (ellipticalDist < baseRadius * n) {
                    layers.push("GRASS");
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

    placeResource("LARGE_TREE", 7, 3);
    placeResource("SMALL_TREE", 8, 2);
    placeResource("ROCK", 6, 2);
    placeResource("FLOWER", 6, 2);

    return resources;
}

/**
 * Generate a simple starter island for new users
 * @param {number} width - Map width in tiles
 * @param {number} height - Map height in tiles
 * @returns {object} Map data in the standard format
 */
export function generateStarterIsland(width = 40, height = 25) {
    const tiles = generateMapData(width, height, width > height);

    // Get grass tile positions for placing resources
    const grassTiles = tiles
        .filter(t => t.layers.includes('GRASS'))
        .map(t => ({ x: t.x, y: t.y }));

    // Shuffle for random placement
    for (let i = grassTiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [grassTiles[i], grassTiles[j]] = [grassTiles[j], grassTiles[i]];
    }

    const resources = [];
    const numTrees = Math.floor(grassTiles.length * 0.04);
    const numRocks = Math.floor(grassTiles.length * 0.02);
    const numFlowers = Math.floor(grassTiles.length * 0.03);

    let idx = 0;

    // Place trees
    for (let i = 0; i < numTrees && idx < grassTiles.length; i++) {
        const pos = grassTiles[idx++];
        const type = Math.random() > 0.5 ? 'LARGE_TREE' : 'PINE_TREE';
        resources.push({ type, x: pos.x, y: pos.y });
    }

    // Place rocks
    for (let i = 0; i < numRocks && idx < grassTiles.length; i++) {
        const pos = grassTiles[idx++];
        resources.push({ type: 'ROCK', x: pos.x, y: pos.y });
    }

    // Place flowers
    for (let i = 0; i < numFlowers && idx < grassTiles.length; i++) {
        const pos = grassTiles[idx++];
        resources.push({ type: 'FLOWER', x: pos.x, y: pos.y });
    }

    // Place farmhouse near center
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);

    const structures = [
        { type: 'FARMHOUSE', x: cx - 1, y: cy - 1, width: 3, height: 2 }
    ];

    // A couple chickens and a rooster
    const chickens = [
        { x: cx + 3, y: cy + 1 },
        { x: cx + 2, y: cy + 2 }
    ];

    const cockerels = [
        { x: cx + 4, y: cy + 2 }
    ];

    return {
        width,
        height,
        tiles,
        structures,
        resources,
        npcs: [],
        chickens,
        cockerels,
        introText: null,
        pageTitle: null,
        collectables: []
    };
}

export function generateMapFiles() {
    // Generate landscape map
    const landscapeMap = {
        width: 72,
        height: 48,
        tiles: generateMapData(72, 48, true),
        structures: [
            {
                type: "FARMHOUSE",
                x: 30,
                y: 20,
                width: 8,
                height: 6
            },
            {
                type: "CHICKEN_COOP",
                x: 45,
                y: 25,
                width: 5,
                height: 3
            },
            {
                type: "SIGN",
                x: 55,
                y: 15,
                width: 12,
                height: 8
            }
        ],
        resources: generateResources(72, 48, true),
        npcs: [
            {
                name: "Joshua",
                x: 40,
                y: 22,
                message: "Welcome to my farm! It looks like the chickens are having a great time."
            }
        ],
        chickens: [
            { x: 47, y: 26 },
            { x: 48, y: 27 },
            { x: 46, y: 27 }
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
                message: "Welcome to my farm! It looks like the chickens are having a great time."
            }
        ],
        chickens: [
            { x: 26, y: 46 },
            { x: 27, y: 47 },
            { x: 27, y: 46 }
        ]
    };

    return { landscapeMap, portraitMap };
} 