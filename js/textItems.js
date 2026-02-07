// Text Items System - manages placeable text tiles that merge when adjacent
// Adjacent text tiles form groups that share a single rich-text content block

class TextItemsSystem {
    constructor() {
        // Set of tile positions that are text items: "x,y" -> true
        this.tiles = new Set();
        // Group content keyed by canonical root key (smallest "x,y" in group): string -> html
        this.groupContentMap = new Map();
    }

    addTile(x, y) {
        const key = `${x},${y}`;
        if (this.tiles.has(key)) return;

        // Before adding, find adjacent groups that will merge
        const adjacentGroupRoots = new Set();
        const neighbors = this.getAdjacentTextTiles(x, y);
        for (const n of neighbors) {
            const group = this.getGroupContaining(n.x, n.y);
            if (group) {
                adjacentGroupRoots.add(group.rootKey);
            }
        }

        // Collect content from adjacent groups before merging
        let mergedContent = '';
        for (const rootKey of adjacentGroupRoots) {
            const content = this.groupContentMap.get(rootKey);
            if (content) {
                mergedContent = mergedContent || content;
            }
        }

        // Add the tile
        this.tiles.add(key);

        // Clean up old group content entries for merged groups
        for (const rootKey of adjacentGroupRoots) {
            this.groupContentMap.delete(rootKey);
        }

        // Assign merged content to the new group
        const newGroup = this.getGroupContaining(x, y);
        if (newGroup && mergedContent) {
            this.groupContentMap.set(newGroup.rootKey, mergedContent);
        }
    }

    removeTile(x, y) {
        const key = `${x},${y}`;
        if (!this.tiles.has(key)) return;

        // Get the group this tile belongs to before removal
        const oldGroup = this.getGroupContaining(x, y);
        const oldContent = oldGroup ? this.groupContentMap.get(oldGroup.rootKey) : '';

        // Remove old group content
        if (oldGroup) {
            this.groupContentMap.delete(oldGroup.rootKey);
        }

        // Remove the tile
        this.tiles.delete(key);

        // After removal, the old group may have split into multiple groups
        // Assign the old content to each resulting sub-group
        if (oldGroup) {
            const remainingTiles = oldGroup.tiles.filter(t => !(t.x === x && t.y === y));
            const visited = new Set();

            for (const tile of remainingTiles) {
                const tKey = `${tile.x},${tile.y}`;
                if (visited.has(tKey)) continue;

                const subGroup = this.getGroupContaining(tile.x, tile.y);
                if (subGroup) {
                    for (const st of subGroup.tiles) {
                        visited.add(`${st.x},${st.y}`);
                    }
                    if (oldContent) {
                        this.groupContentMap.set(subGroup.rootKey, oldContent);
                    }
                }
            }
        }
    }

    hasTile(x, y) {
        return this.tiles.has(`${x},${y}`);
    }

    getAdjacentTextTiles(x, y) {
        const adjacent = [];
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (this.tiles.has(`${nx},${ny}`)) {
                adjacent.push({ x: nx, y: ny });
            }
        }
        return adjacent;
    }

    // Find the connected group containing tile (x, y) using flood fill
    getGroupContaining(x, y) {
        if (!this.tiles.has(`${x},${y}`)) return null;

        const visited = new Set();
        const groupTiles = [];
        const queue = [{ x, y }];

        while (queue.length > 0) {
            const { x: cx, y: cy } = queue.shift();
            const key = `${cx},${cy}`;
            if (visited.has(key)) continue;
            if (!this.tiles.has(key)) continue;

            visited.add(key);
            groupTiles.push({ x: cx, y: cy });

            const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dx, dy] of dirs) {
                const nk = `${cx + dx},${cy + dy}`;
                if (!visited.has(nk) && this.tiles.has(nk)) {
                    queue.push({ x: cx + dx, y: cy + dy });
                }
            }
        }

        if (groupTiles.length === 0) return null;

        // Calculate bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const t of groupTiles) {
            if (t.x < minX) minX = t.x;
            if (t.y < minY) minY = t.y;
            if (t.x > maxX) maxX = t.x;
            if (t.y > maxY) maxY = t.y;
        }

        // Root key is the top-left tile of the bounding box that is actually in the group
        // Sort tiles by y then x to find canonical root
        groupTiles.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);
        const rootKey = `${groupTiles[0].x},${groupTiles[0].y}`;

        return {
            tiles: groupTiles,
            rootKey,
            bounds: {
                x: minX,
                y: minY,
                w: maxX - minX + 1,
                h: maxY - minY + 1
            }
        };
    }

    // Get all distinct groups
    getAllGroups() {
        const visited = new Set();
        const groups = [];

        for (const key of this.tiles) {
            if (visited.has(key)) continue;

            const [x, y] = key.split(',').map(Number);
            const group = this.getGroupContaining(x, y);
            if (!group) continue;

            for (const t of group.tiles) {
                visited.add(`${t.x},${t.y}`);
            }

            group.content = this.groupContentMap.get(group.rootKey) || '';
            groups.push(group);
        }

        return groups;
    }

    setGroupContent(rootKey, content) {
        this.groupContentMap.set(rootKey, content);
    }

    getGroupContent(rootKey) {
        return this.groupContentMap.get(rootKey) || '';
    }

    // Serialize for map save
    toMapData() {
        const groups = this.getAllGroups();
        return groups.map(group => ({
            tiles: group.tiles.map(t => ({ x: t.x, y: t.y })),
            content: group.content || ''
        }));
    }

    // Deserialize from map data
    loadFromMapData(data) {
        this.tiles.clear();
        this.groupContentMap.clear();

        if (!data || !Array.isArray(data)) return;

        for (const group of data) {
            if (!group.tiles || !Array.isArray(group.tiles)) continue;

            // Add all tiles
            for (const tile of group.tiles) {
                this.tiles.add(`${tile.x},${tile.y}`);
            }

            // After adding all tiles for this group, find the canonical root and set content
            if (group.tiles.length > 0) {
                const firstTile = group.tiles[0];
                const resolvedGroup = this.getGroupContaining(firstTile.x, firstTile.y);
                if (resolvedGroup) {
                    this.groupContentMap.set(resolvedGroup.rootKey, group.content || '');
                }
            }
        }
    }

    clear() {
        this.tiles.clear();
        this.groupContentMap.clear();
    }
}

export const textItemsSystem = new TextItemsSystem();
