// Text Tiles System
// Manages text tiles that can be grouped into blocks and display rich text HTML content

class TextTilesSystem {
    constructor() {
        // Map of "x,y" -> { groupId: string }
        this.tiles = new Map();
        // Map of groupId -> { htmlContent: string|null, tiles: Set<string> }
        this.groups = new Map();
        this.nextGroupId = 1;
    }

    // Load from map data
    loadFromMapData(textTilesData) {
        this.tiles.clear();
        this.groups.clear();
        this.nextGroupId = 1;

        if (!textTilesData || !Array.isArray(textTilesData)) return;

        // Rebuild tiles map
        textTilesData.forEach(item => {
            const key = `${item.x},${item.y}`;
            this.tiles.set(key, { groupId: null });
        });

        // Rebuild groups by flood-filling adjacent tiles
        this._rebuildGroups();

        // Apply html content from saved groups
        if (textTilesData.length > 0 && textTilesData[0].htmlContent !== undefined) {
            const groupHtmlMap = new Map();
            textTilesData.forEach(item => {
                if (item.htmlContent) {
                    const key = `${item.x},${item.y}`;
                    const tile = this.tiles.get(key);
                    if (tile && tile.groupId && !groupHtmlMap.has(tile.groupId)) {
                        groupHtmlMap.set(tile.groupId, item.htmlContent);
                    }
                }
            });
            groupHtmlMap.forEach((htmlContent, groupId) => {
                const group = this.groups.get(groupId);
                if (group) group.htmlContent = htmlContent;
            });
        }
    }

    // Export for saving
    toMapData() {
        const data = [];
        this.tiles.forEach((tileData, key) => {
            const [x, y] = key.split(',').map(Number);
            const group = tileData.groupId ? this.groups.get(tileData.groupId) : null;
            data.push({
                x, y,
                htmlContent: group ? group.htmlContent : null
            });
        });
        return data;
    }

    // Add a text tile at position
    addTile(x, y) {
        const key = `${x},${y}`;
        if (this.tiles.has(key)) return;

        this.tiles.set(key, { groupId: null });
        this._rebuildGroups();
    }

    // Remove a text tile at position
    removeTile(x, y) {
        const key = `${x},${y}`;
        if (!this.tiles.has(key)) return;

        this.tiles.delete(key);
        this._rebuildGroups();
    }

    // Check if a position has a text tile
    hasTile(x, y) {
        return this.tiles.has(`${x},${y}`);
    }

    // Get group info for a tile position
    getGroup(x, y) {
        const key = `${x},${y}`;
        const tile = this.tiles.get(key);
        if (!tile || !tile.groupId) return null;
        return this.groups.get(tile.groupId) || null;
    }

    // Get the group ID for a tile position
    getGroupId(x, y) {
        const key = `${x},${y}`;
        const tile = this.tiles.get(key);
        return tile ? tile.groupId : null;
    }

    // Set HTML content for the group containing the given tile
    setGroupHtml(x, y, htmlContent) {
        const key = `${x},${y}`;
        const tile = this.tiles.get(key);
        if (!tile || !tile.groupId) return;
        const group = this.groups.get(tile.groupId);
        if (group) group.htmlContent = htmlContent;
    }

    // Get all unique groups with their bounding boxes
    getAllGroups() {
        const result = [];
        this.groups.forEach((group, groupId) => {
            const bounds = this._getGroupBounds(groupId);
            if (bounds) {
                result.push({
                    groupId,
                    htmlContent: group.htmlContent,
                    ...bounds
                });
            }
        });
        return result;
    }

    // Get bounding box for a group
    _getGroupBounds(groupId) {
        const group = this.groups.get(groupId);
        if (!group || group.tiles.size === 0) return null;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        group.tiles.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        });

        return {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    }

    // Shift all tile positions (used when resizing the map)
    shiftPositions(offsetX, offsetY) {
        const newTiles = new Map();
        const oldGroupHtml = new Map();

        // Collect existing html content per tile
        this.tiles.forEach((tileData, key) => {
            if (tileData.groupId) {
                const group = this.groups.get(tileData.groupId);
                if (group && group.htmlContent) {
                    oldGroupHtml.set(key, group.htmlContent);
                }
            }
        });

        // Shift tile positions
        this.tiles.forEach((tileData, key) => {
            const [x, y] = key.split(',').map(Number);
            const newKey = `${x + offsetX},${y + offsetY}`;
            newTiles.set(newKey, { groupId: null });
        });

        this.tiles = newTiles;
        this._rebuildGroups();

        // Restore html content by matching shifted positions
        oldGroupHtml.forEach((html, oldKey) => {
            const [ox, oy] = oldKey.split(',').map(Number);
            const newKey = `${ox + offsetX},${oy + offsetY}`;
            const tile = this.tiles.get(newKey);
            if (tile && tile.groupId) {
                const group = this.groups.get(tile.groupId);
                if (group && !group.htmlContent) {
                    group.htmlContent = html;
                }
            }
        });
    }

    // Rebuild all groups via flood fill
    _rebuildGroups() {
        // Preserve existing html content by group tile membership
        const oldGroupHtml = new Map();
        this.tiles.forEach((tileData, key) => {
            if (tileData.groupId) {
                const group = this.groups.get(tileData.groupId);
                if (group && group.htmlContent) {
                    oldGroupHtml.set(key, group.htmlContent);
                }
            }
        });

        // Reset all group assignments
        this.tiles.forEach(tileData => { tileData.groupId = null; });
        this.groups.clear();
        this.nextGroupId = 1;

        // Flood fill to find connected components
        const visited = new Set();

        this.tiles.forEach((_, key) => {
            if (visited.has(key)) return;

            const groupId = `txt_group_${this.nextGroupId++}`;
            const groupTiles = new Set();
            const queue = [key];

            while (queue.length > 0) {
                const current = queue.shift();
                if (visited.has(current)) continue;
                if (!this.tiles.has(current)) continue;

                visited.add(current);
                groupTiles.add(current);
                this.tiles.get(current).groupId = groupId;

                // Check 4-directional neighbors
                const [cx, cy] = current.split(',').map(Number);
                const neighbors = [
                    `${cx - 1},${cy}`,
                    `${cx + 1},${cy}`,
                    `${cx},${cy - 1}`,
                    `${cx},${cy + 1}`
                ];

                neighbors.forEach(n => {
                    if (!visited.has(n) && this.tiles.has(n)) {
                        queue.push(n);
                    }
                });
            }

            // Find html content from any tile in this new group
            let htmlContent = null;
            groupTiles.forEach(tileKey => {
                if (!htmlContent && oldGroupHtml.has(tileKey)) {
                    htmlContent = oldGroupHtml.get(tileKey);
                }
            });

            this.groups.set(groupId, {
                htmlContent: htmlContent,
                tiles: groupTiles
            });
        });
    }
}

export const textTilesSystem = new TextTilesSystem();
