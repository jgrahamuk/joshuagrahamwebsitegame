// Pathfinding and movement helpers
export function findPath(start, end, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES) {
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

        getNeighbors(current, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES).forEach(neighbor => {
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