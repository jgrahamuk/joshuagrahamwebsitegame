document.addEventListener('DOMContentLoaded', () => {
    let TILE_SIZE = 40;
    const MAP_WIDTH_TILES = 64;
    const MAP_HEIGHT_TILES = 48;

    const gameContainer = document.getElementById('game-container');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    gameContainer.appendChild(svg);
    updateTileSize();

    let movementController = null;

    const woodCountSpan = document.getElementById('wood-count');
    const stoneCountSpan = document.getElementById('stone-count');

    const player = {
        x: 0,
        y: 0,
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

    // Chicken logic
    const chickenSprites = {
        front: 'chicken-front.png',
        back: 'chicken-back.png',
        left: 'chicken-left.png',
        right: 'chicken-right.png',
        peckRight: 'chicken-peck-right.png',
        peckLeft: 'chicken-peck-left.png',
    };

    function randomGrassOrDirt() {
        while (true) {
            const x = Math.floor(Math.random() * MAP_WIDTH_TILES);
            const y = Math.floor(Math.random() * MAP_HEIGHT_TILES);
            const tiles = map[y][x];
            if (tiles.includes(tileTypes.GRASS) || tiles.includes(tileTypes.DIRT)) {
                return { x, y };
            }
        }
    }

    let chickens = [];

    function createChickens() {
        chickens.forEach(chicken => {
            chicken.element = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            updateChickenPosition(chicken);
            svg.appendChild(chicken.element);
        });
    }

    function updateChickenPosition(chicken) {
        let sprite;
        if (chicken.state === 'peck' && chicken.isPeckingPose) {
            if (chicken.direction === 'right') sprite = chickenSprites.peckRight;
            else if (chicken.direction === 'left') sprite = chickenSprites.peckLeft;
            else sprite = chickenSprites[chicken.direction];
        } else {
            sprite = chickenSprites[chicken.direction];
        }
        chicken.element.setAttribute('href', `resources/images/${sprite}`);
        chicken.element.setAttribute('x', chicken.x * TILE_SIZE);
        chicken.element.setAttribute('y', chicken.y * TILE_SIZE);
        chicken.element.setAttribute('width', TILE_SIZE);
        chicken.element.setAttribute('height', TILE_SIZE);
    }

    function moveChicken(chicken, to) {
        // Only move if destination is grass/dirt
        if (!map[to.y][to.x].includes(tileTypes.GRASS) && !map[to.y][to.x].includes(tileTypes.DIRT)) return;
        // Use A* pathfinding
        const start = { x: chicken.x, y: chicken.y };
        const end = { x: to.x, y: to.y };
        const path = findPath(start, end);
        if (path && path.length > 1) {
            chicken.path = path.slice(1); // Exclude current position
            chicken.moving = true;
        }
    }

    function chickenTick() {
        const now = Date.now();
        chickens.forEach(chicken => {
            // Handle pecking animation
            if (chicken.state === 'peck') {
                if (now >= chicken.nextPeckFrame) {
                    if (chicken.pecksLeft > 0) {
                        chicken.isPeckingPose = !chicken.isPeckingPose;
                        updateChickenPosition(chicken);
                        chicken.nextPeckFrame = now + 150 + Math.floor(Math.random() * 100);
                        if (!chicken.isPeckingPose) chicken.pecksLeft--;
                    } else {
                        chicken.state = 'walk';
                        chicken.isPeckingPose = false;
                        updateChickenPosition(chicken);
                    }
                }
                return;
            }
            // Move along path if moving
            if (chicken.moving && chicken.path && chicken.path.length > 0) {
                const next = chicken.path.shift();
                // Set direction
                if (next.x > chicken.x) chicken.direction = 'right';
                else if (next.x < chicken.x) chicken.direction = 'left';
                else if (next.y > chicken.y) chicken.direction = 'front';
                else if (next.y < chicken.y) chicken.direction = 'back';
                chicken.x = next.x;
                chicken.y = next.y;
                chicken.lastMove = now;
                updateChickenPosition(chicken);
                if (chicken.path.length === 0) {
                    chicken.moving = false;
                    // Start pecking after move
                    if (chicken.direction === 'right' || chicken.direction === 'left') {
                        chicken.state = 'peck';
                        chicken.pecksLeft = 3 + Math.floor(Math.random() * 2);
                        chicken.isPeckingPose = false;
                        chicken.nextPeckFrame = now + 100;
                        updateChickenPosition(chicken);
                        return;
                    }
                }
                return;
            }
            // Far move?
            if (now > chicken.nextFarMove && !chicken.moving && chicken.state !== 'peck') {
                const pos = randomGrassOrDirt();
                moveChicken(chicken, pos);
                chicken.nextFarMove = now + 30000 + Math.random() * 30000;
                return;
            }
            // Move to a nearby tile if not moving
            if (!chicken.moving && now - chicken.lastMove > 1000 + Math.random() * 2000) {
                let tries = 0;
                while (tries < 10) {
                    const dx = Math.floor(Math.random() * 7) - 3;
                    const dy = Math.floor(Math.random() * 7) - 3;
                    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { tries++; continue; }
                    const nx = chicken.x + dx;
                    const ny = chicken.y + dy;
                    if (nx >= 0 && ny >= 0 && nx < MAP_WIDTH_TILES && ny < MAP_HEIGHT_TILES && (map[ny][nx].includes(tileTypes.GRASS) || map[ny][nx].includes(tileTypes.DIRT))) {
                        moveChicken(chicken, { x: nx, y: ny });
                        break;
                    }
                    tries++;
                }
            }
        });
    }

    function updateTileSize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        TILE_SIZE = Math.floor(Math.min(w / MAP_WIDTH_TILES, h / MAP_HEIGHT_TILES));
        svg.setAttribute('width', MAP_WIDTH_TILES * TILE_SIZE);
        svg.setAttribute('height', MAP_HEIGHT_TILES * TILE_SIZE);
    }

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

        // Find a grass or dirt tile near the center for player start
        function isValidStartTile(x, y) {
            if (x < 0 || y < 0 || x >= MAP_WIDTH_TILES || y >= MAP_HEIGHT_TILES) return false;
            const tiles = map[y][x];
            return tiles.includes(tileTypes.GRASS) || tiles.includes(tileTypes.DIRT);
        }
        let found = false;
        let radius = 0;
        while (!found && radius < Math.max(MAP_WIDTH_TILES, MAP_HEIGHT_TILES)) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const x = cx + dx, y = cy + dy;
                    if (isValidStartTile(x, y)) {
                        player.x = x;
                        player.y = y;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            radius++;
        }

        // Initialize chickens after map is ready
        chickens = Array.from({ length: 3 }, () => {
            const pos = randomGrassOrDirt();
            return {
                x: pos.x,
                y: pos.y,
                direction: 'front',
                state: 'walk', // 'walk' or 'peck'
                pecksLeft: 0,
                lastMove: Date.now(),
                nextFarMove: Date.now() + 30000 + Math.random() * 30000,
                element: null,
            };
        });
        createChickens();
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
        createChickens();
    }

    function createPlayer() {
        player.element = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        updatePlayerPosition();
        svg.appendChild(player.element);
        createChickens();
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

    window.addEventListener('resize', () => {
        updateTileSize();
        drawMap();
        createPlayer();
    });

    // Animation loop for chickens
    setInterval(() => {
        chickenTick();
        chickens.forEach(updateChickenPosition);
    }, 500);
}); 