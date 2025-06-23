document.addEventListener('DOMContentLoaded', () => {
    const TILE_SIZE = 40;
    const MAP_WIDTH_TILES = 32;
    const MAP_HEIGHT_TILES = 24;

    const gameContainer = document.getElementById('game-container');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', MAP_WIDTH_TILES * TILE_SIZE);
    svg.setAttribute('height', MAP_HEIGHT_TILES * TILE_SIZE);
    gameContainer.appendChild(svg);

    let movementController = null;

    const woodCountSpan = document.getElementById('wood-count');
    const stoneCountSpan = document.getElementById('stone-count');

    const player = {
        x: 10,
        y: 7,
        element: null,
        direction: 'front' // 'front', 'back', 'left', 'right'
    };

    const resources = {
        wood: 0,
        stone: 0
    };

    const tileTypes = {
        WATER: { color: 'blue', passable: false, resource: null },
        DIRT: { color: 'brown', passable: true, resource: null },
        GRASS: { color: 'green', passable: true, resource: null },
        ROCK: { color: 'grey', passable: false, resource: 'stone' },
        FLOWER: { color: 'pink', passable: true, resource: null },
        SMALL_TREE: { color: 'darkgreen', passable: false, resource: 'wood' },
        LARGE_TREE: { color: 'darkgreen', passable: false, resource: 'wood' },
    };

    // Map is now a 2D array of tile arrays for layering.
    const map = [];

    function initializeMap() {
        // Parameters for organic island shape
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
    }

    function getTile(x, y) {
        if (x >= 0 && x < MAP_WIDTH_TILES && y >= 0 && y < MAP_HEIGHT_TILES) {
            const tiles = map[y][x];
            return tiles[tiles.length - 1];
        }
        return null;
    }

    function drawMap() {
        svg.innerHTML = '';
        for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
            for (let x = 0; x < MAP_WIDTH_TILES; x++) {
                const tiles = map[y][x];
                // Base tile
                let baseTile = tiles.find(t => t === tileTypes.DIRT) ? 'tile-dirt.png'
                    : tiles.find(t => t === tileTypes.GRASS) ? 'tile-grass.png'
                        : tiles.find(t => t === tileTypes.WATER || (t.color && t.color === '#3bbcff')) ? 'tile-water.png'
                            : 'tile-grass.png';
                let basePath = `resources/images/${baseTile}`;
                const imgBase = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                imgBase.setAttribute('href', basePath);
                imgBase.setAttribute('x', x * TILE_SIZE);
                imgBase.setAttribute('y', y * TILE_SIZE);
                imgBase.setAttribute('width', TILE_SIZE);
                imgBase.setAttribute('height', TILE_SIZE);
                svg.appendChild(imgBase);

                // Overlay for resources
                const top = tiles[tiles.length - 1];
                let overlay = null;
                if (top === tileTypes.LARGE_TREE || top === tileTypes.SMALL_TREE) {
                    overlay = 'tree.png';
                } else if (top === tileTypes.ROCK) {
                    overlay = 'stone.png';
                } else if (top === tileTypes.FLOWER) {
                    overlay = 'flower.png';
                }
                if (overlay) {
                    const imgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                    imgOverlay.setAttribute('href', `resources/images/${overlay}`);
                    imgOverlay.setAttribute('x', x * TILE_SIZE);
                    imgOverlay.setAttribute('y', y * TILE_SIZE);
                    imgOverlay.setAttribute('width', TILE_SIZE);
                    imgOverlay.setAttribute('height', TILE_SIZE);
                    svg.appendChild(imgOverlay);
                }
            }
        }
    }

    function createPlayer() {
        player.element = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        updatePlayerPosition();
        svg.appendChild(player.element);
    }

    function updatePlayerPosition() {
        // Set correct sprite based on direction
        let sprite = `resources/images/character-${player.direction}.png`;
        player.element.setAttribute('href', sprite);
        player.element.setAttribute('x', player.x * TILE_SIZE);
        player.element.setAttribute('y', player.y * TILE_SIZE);
        player.element.setAttribute('width', TILE_SIZE);
        player.element.setAttribute('height', TILE_SIZE);
    }

    // A* Pathfinding
    function findPath(start, end) {
        const closedSet = new Set();
        const openSet = [start];
        const cameFrom = new Map();

        const gScore = new Map();
        gScore.set(`${start.x},${start.y}`, 0);

        const fScore = new Map();
        fScore.set(`${start.x},${start.y}`, heuristic(start, end));

        while (openSet.length > 0) {
            let current = openSet.reduce((a, b) => (fScore.get(`${a.x},${a.y}`) || Infinity) < (fScore.get(`${b.x},${b.y}`) || Infinity) ? a : b);

            if (current.x === end.x && current.y === end.y) {
                return reconstructPath(cameFrom, current);
            }

            openSet.splice(openSet.indexOf(current), 1);
            closedSet.add(`${current.x},${current.y}`);

            getNeighbors(current).forEach(neighbor => {
                const neighborId = `${neighbor.x},${neighbor.y}`;
                if (closedSet.has(neighborId)) {
                    return; // Ignore the neighbor which is already evaluated.
                }

                // The distance from start to a neighbor
                const tentativeGScore = gScore.get(`${current.x},${current.y}`) + 1;

                // Check if the neighbor is in openSet
                const inOpenSet = openSet.some(node => node.x === neighbor.x && node.y === neighbor.y);

                if (!inOpenSet) { // Discover a new node
                    openSet.push(neighbor);
                } else if (tentativeGScore >= (gScore.get(neighborId) || Infinity)) {
                    return; // This is not a better path.
                }

                // This path is the best until now. Record it!
                cameFrom.set(neighborId, current);
                gScore.set(neighborId, tentativeGScore);
                fScore.set(neighborId, tentativeGScore + heuristic(neighbor, end));
            });
        }

        return null; // No path found
    }

    function heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    function reconstructPath(cameFrom, current) {
        const totalPath = [current];
        const maxPathLength = MAP_WIDTH_TILES * MAP_HEIGHT_TILES; // Safety break

        while (cameFrom.has(`${current.x},${current.y}`)) {
            current = cameFrom.get(`${current.x},${current.y}`);
            totalPath.unshift(current);

            if (totalPath.length > maxPathLength) {
                console.error("Path reconstruction exceeded max length. Aborting due to likely infinite loop.");
                return null; // Return null to indicate a failure
            }
        }
        return totalPath;
    }

    function getNeighbors(node, all = false) {
        const neighbors = [];
        const directions = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
        directions.forEach(dir => {
            const x = node.x + dir.x;
            const y = node.y + dir.y;
            if (x >= 0 && x < MAP_WIDTH_TILES && y >= 0 && y < MAP_HEIGHT_TILES) {
                if (all || getTile(x, y).passable) {
                    neighbors.push({ x, y });
                }
            }
        });
        return neighbors;
    }

    async function movePlayer(path) {
        const controller = { cancelled: false, cancel: function () { this.cancelled = true; } };
        movementController = controller;

        let last = { x: player.x, y: player.y };
        for (const point of path) {
            if (controller.cancelled) {
                return false; // Movement was cancelled
            }
            // Determine direction
            if (point.x > last.x) player.direction = 'right';
            else if (point.x < last.x) player.direction = 'left';
            else if (point.y > last.y) player.direction = 'front';
            else if (point.y < last.y) player.direction = 'back';
            last = { ...point };
            player.x = point.x;
            player.y = point.y;
            updatePlayerPosition();
            await new Promise(resolve => setTimeout(resolve, 100)); // animation speed
        }

        if (movementController === controller) {
            movementController = null;
        }
        return true; // Movement completed successfully
    }

    svg.addEventListener('click', (e) => {
        if (movementController) {
            movementController.cancel();
        }

        const rect = svg.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / TILE_SIZE);
        const y = Math.floor((e.clientY - rect.top) / TILE_SIZE);

        if (x >= 0 && x < MAP_WIDTH_TILES && y >= 0 && y < MAP_HEIGHT_TILES) {
            const start = { x: player.x, y: player.y };
            const end = { x, y };
            const tile = getTile(x, y);

            if (tile.passable) {
                const path = findPath(start, end);
                if (path) {
                    movePlayer(path.slice(1));
                }
            } else if (tile.resource) {
                // Find nearest passable tile to the resource
                const neighbors = getNeighbors(end, true); // Get all neighbors, even impassable
                let bestNeighbor = null;
                let bestPath = null;

                // Find a reachable neighbor
                for (const neighbor of neighbors) {
                    if (getTile(neighbor.x, neighbor.y).passable) {
                        const path = findPath(start, neighbor);
                        if (path && (!bestPath || path.length < bestPath.length)) {
                            bestPath = path;
                            bestNeighbor = neighbor;
                        }
                    }
                }

                if (bestPath) {
                    movePlayer(bestPath.slice(1)).then((completed) => {
                        if (completed) {
                            gatherResource(end);
                        }
                    });
                }
            }
        }
    });

    function gatherResource(resourcePos) {
        const tile = getTile(resourcePos.x, resourcePos.y);
        if (!tile.resource) return;

        console.log(`Gathering ${tile.resource} at`, resourcePos);

        // Add resource to inventory
        resources[tile.resource]++;
        updateResourceUI();

        // Make tile temporarily passable by removing the top layer
        const originalTiles = map[resourcePos.y][resourcePos.x];
        const removedTile = originalTiles.pop();
        drawMap();
        createPlayer(); // Re-add player to be on top

        // Respawn after 30 seconds
        setTimeout(() => {
            map[resourcePos.y][resourcePos.x].push(removedTile);
            drawMap();
            createPlayer(); // Re-add player to be on top
            console.log(`${removedTile.resource} respawned at`, resourcePos);
        }, 30000);
    }

    function updateResourceUI() {
        woodCountSpan.textContent = resources.wood;
        stoneCountSpan.textContent = resources.stone;
    }

    initializeMap();
    drawMap();
    createPlayer();
}); 