// Pathfinding and movement helpers
export function findPath(start, end, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES) {
    const editorMode = window.mapEditor && window.mapEditor.isActive;
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

        getNeighbors(current, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, editorMode).forEach(neighbor => {
            const neighborId = `${neighbor.x},${neighbor.y}`;
            if (closedSet.has(neighborId)) {
                return;
            }
            const tentativeGScore = gScore.get(`${current.x},${current.y}`) + 1;
            const inOpenSet = openSet.some(node => node.x === neighbor.x && node.y === neighbor.y);
            if (!inOpenSet) {
                openSet.push(neighbor);
            } else if (tentativeGScore >= (gScore.get(neighborId) || Infinity)) {
                return;
            }
            cameFrom.set(neighborId, current);
            gScore.set(neighborId, tentativeGScore);
            fScore.set(neighborId, tentativeGScore + heuristic(neighbor, end));
        });
    }
    return null;
}

function heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function reconstructPath(cameFrom, current) {
    const totalPath = [current];
    const maxPathLength = 1000;
    while (cameFrom.has(`${current.x},${current.y}`)) {
        current = cameFrom.get(`${current.x},${current.y}`);
        totalPath.unshift(current);
        if (totalPath.length > maxPathLength) {
            return null;
        }
    }
    return totalPath;
}

export function getNeighbors(node, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, all = false) {
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

export function findAdjacentTile(targetX, targetY, playerX, playerY, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES) {
    const editorMode = window.mapEditor && window.mapEditor.isActive;
    const adjacentTiles = [];
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const nx = targetX + dx;
            const ny = targetY + dy;
            if (nx >= 0 && ny >= 0 && nx < MAP_WIDTH_TILES && ny < MAP_HEIGHT_TILES) {
                const adjacentTile = getTile(nx, ny);
                if (editorMode || (adjacentTile && adjacentTile.passable)) {
                    adjacentTiles.push({ x: nx, y: ny });
                }
            }
        }
    }

    if (adjacentTiles.length > 0) {
        // Find the closest adjacent tile
        let closestTile = adjacentTiles[0];
        let closestDistance = Math.abs(playerX - closestTile.x) + Math.abs(playerY - closestTile.y);

        adjacentTiles.forEach(tile => {
            const distance = Math.abs(playerX - tile.x) + Math.abs(playerY - tile.y);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestTile = tile;
            }
        });

        return closestTile;
    }
    return null;
}

export function moveToTarget(targetX, targetY, player, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, interactionType, interactionData = null) {
    const start = { x: player.x, y: player.y };
    let end = { x: targetX, y: targetY };
    let path = null;

    // Check if target is passable (in editor mode, all tiles are walkable)
    const editorMode = window.mapEditor && window.mapEditor.isActive;
    const targetTile = getTile(targetX, targetY);
    if (editorMode || (targetTile && targetTile.passable)) {
        // Direct path to target
        path = findPath(start, end, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES);
    } else {
        // Find adjacent tile and path to it
        const adjacentTile = findAdjacentTile(targetX, targetY, player.x, player.y, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES);
        if (adjacentTile) {
            end = adjacentTile;
            path = findPath(start, end, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES);
        }
    }

    if (path) {
        if (interactionType === 'resource') {
            player.moveTo(path.slice(1), { x: targetX, y: targetY });
        } else if (interactionType === 'npc') {
            player.moveTo(path.slice(1), null, { type: 'npc', data: interactionData });
        } else if (interactionType === 'portal') {
            player.moveTo(path.slice(1), null, { type: 'portal', data: interactionData });
        } else {
            player.moveTo(path.slice(1));
        }
    }

    return path;
} 