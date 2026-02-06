// Image Tiles System
// Manages image tiles that can be grouped into blocks and display uploaded images

class ImageTilesSystem {
    constructor() {
        // Map of "x,y" -> { groupId: string }
        this.tiles = new Map();
        // Map of groupId -> { imageData: string|null, tiles: Set<string> }
        this.groups = new Map();
        this.nextGroupId = 1;
    }

    // Load from map data
    loadFromMapData(imageTilesData) {
        this.tiles.clear();
        this.groups.clear();
        this.nextGroupId = 1;

        if (!imageTilesData || !Array.isArray(imageTilesData)) return;

        // Rebuild tiles map
        imageTilesData.forEach(item => {
            const key = `${item.x},${item.y}`;
            this.tiles.set(key, { groupId: null });
        });

        // Rebuild groups by flood-filling adjacent tiles
        this._rebuildGroups();

        // Apply image data from saved groups
        if (imageTilesData.length > 0 && imageTilesData[0].imageData !== undefined) {
            // New format: each tile stores imageData for its group
            const groupImages = new Map();
            imageTilesData.forEach(item => {
                if (item.imageData) {
                    const key = `${item.x},${item.y}`;
                    const tile = this.tiles.get(key);
                    if (tile && tile.groupId && !groupImages.has(tile.groupId)) {
                        groupImages.set(tile.groupId, item.imageData);
                    }
                }
            });
            groupImages.forEach((imageData, groupId) => {
                const group = this.groups.get(groupId);
                if (group) group.imageData = imageData;
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
                imageData: group ? group.imageData : null
            });
        });
        return data;
    }

    // Add an image tile at position
    addTile(x, y) {
        const key = `${x},${y}`;
        if (this.tiles.has(key)) return;

        this.tiles.set(key, { groupId: null });
        this._rebuildGroups();
    }

    // Remove an image tile at position
    removeTile(x, y) {
        const key = `${x},${y}`;
        if (!this.tiles.has(key)) return;

        this.tiles.delete(key);
        this._rebuildGroups();
    }

    // Check if a position has an image tile
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

    // Set image data for the group containing the given tile
    setGroupImage(x, y, imageData) {
        const key = `${x},${y}`;
        const tile = this.tiles.get(key);
        if (!tile || !tile.groupId) return;
        const group = this.groups.get(tile.groupId);
        if (group) group.imageData = imageData;
    }

    // Get all unique groups with their bounding boxes
    getAllGroups() {
        const result = [];
        this.groups.forEach((group, groupId) => {
            const bounds = this._getGroupBounds(groupId);
            if (bounds) {
                result.push({
                    groupId,
                    imageData: group.imageData,
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

    // Rebuild all groups via flood fill
    _rebuildGroups() {
        // Preserve existing image data by group tile membership
        const oldGroupImages = new Map();
        this.tiles.forEach((tileData, key) => {
            if (tileData.groupId) {
                const group = this.groups.get(tileData.groupId);
                if (group && group.imageData) {
                    oldGroupImages.set(key, group.imageData);
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

            const groupId = `img_group_${this.nextGroupId++}`;
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

            // Find image data from any tile in this new group
            let imageData = null;
            groupTiles.forEach(tileKey => {
                if (!imageData && oldGroupImages.has(tileKey)) {
                    imageData = oldGroupImages.get(tileKey);
                }
            });

            this.groups.set(groupId, {
                imageData: imageData,
                tiles: groupTiles
            });
        });
    }
}

export const imageTilesSystem = new ImageTilesSystem();
