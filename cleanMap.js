const fs = require('fs');

// Read the map file
const mapData = fs.readFileSync('maps/map.json', 'utf8');

// Fix missing commas first
const fixedCommas = mapData.replace(/"\n\s*"/g, '",\n        "');

// Parse the JSON
let map = JSON.parse(fixedCommas);

// Clean up the tiles
map.tiles = map.tiles.map(tile => {
    // Remove duplicate consecutive layers
    const uniqueLayers = tile.layers.reduce((acc, layer) => {
        if (acc.length === 0 || acc[acc.length - 1] !== layer) {
            acc.push(layer);
        }
        return acc;
    }, []);

    // Ensure WATER is always first if present
    if (uniqueLayers.includes('WATER')) {
        const withoutWater = uniqueLayers.filter(l => l !== 'WATER');
        return {
            x: tile.x,
            y: tile.y,
            layers: ['WATER', ...withoutWater]
        };
    }

    return {
        x: tile.x,
        y: tile.y,
        layers: uniqueLayers
    };
});

// Write the cleaned map back to file
fs.writeFileSync('maps/map.json', JSON.stringify(map, null, 2)); 