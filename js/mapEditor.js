import { tileTypes, placeResourceAtPosition, removeResource, map, MAP_WIDTH_TILES, MAP_HEIGHT_TILES } from './map.js';
import { getSpriteUrl } from './spriteCache.js';

export class MapEditor {
    constructor(svg, gameContainer) {
        this.svg = svg;
        this.gameContainer = gameContainer;
        this.isActive = false;
        this.selectedTool = null;
        this.toolbar = null;
        this.toolbarContainer = null;

        this.tools = [
            { id: 'delete', name: 'Delete', icon: '🗑️', type: 'delete' },
            { id: 'grass', name: 'Grass', icon: 'tile-grass.png', type: 'tile', tileType: tileTypes.GRASS },
            { id: 'dirt', name: 'Dirt', icon: 'tile-dirt.png', type: 'tile', tileType: tileTypes.DIRT },
            { id: 'water', name: 'Water', icon: 'tile-water.png', type: 'tile', tileType: tileTypes.WATER },
            { id: 'large_tree', name: 'Large Tree', icon: 'tree.png', type: 'resource', tileType: tileTypes.LARGE_TREE },
            { id: 'small_tree', name: 'Small Tree', icon: 'tree.png', type: 'resource', tileType: tileTypes.SMALL_TREE },
            { id: 'rock', name: 'Rock', icon: 'stone.png', type: 'resource', tileType: tileTypes.ROCK },
            { id: 'flower', name: 'Flower', icon: 'flower.png', type: 'resource', tileType: tileTypes.FLOWER }
        ];

        this.setupKeyboardShortcuts();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+E to toggle editor
            if (e.ctrlKey && e.shiftKey && e.key === 'E') {
                e.preventDefault();
                this.toggleEditor();
            }

            // Ctrl+Shift+S to export map (only when editor is active)
            if (this.isActive && e.ctrlKey && e.shiftKey && e.key === 'S') {
                e.preventDefault();
                this.exportMap();
            }
        });
    }

    toggleEditor() {
        if (this.isActive) {
            this.hideToolbar();
        } else {
            this.showToolbar();
        }
    }

    showToolbar() {
        this.isActive = true;
        this.createToolbar();
        this.setupMapClickHandler();
        this.showEditorIndicator();
    }

    hideToolbar() {
        this.isActive = false;
        this.selectedTool = null;
        if (this.toolbarContainer) {
            this.gameContainer.removeChild(this.toolbarContainer);
            this.toolbarContainer = null;
        }
        this.removeMapClickHandler();
        this.hideEditorIndicator();
    }

    createToolbar() {
        this.toolbarContainer = document.createElement('div');
        this.toolbarContainer.id = 'map-editor-toolbar';

        this.tools.forEach(tool => {
            const toolButton = document.createElement('button');

            // Check if the icon is an image file or emoji
            if (tool.icon.endsWith('.png')) {
                // Create an image element for sprite icons
                const img = document.createElement('img');
                img.src = getSpriteUrl(tool.icon);
                toolButton.appendChild(img);
            } else {
                // Use emoji for delete button
                toolButton.innerHTML = tool.icon;
            }

            toolButton.title = tool.name;

            toolButton.addEventListener('click', () => {
                this.selectTool(tool);
            });

            this.toolbarContainer.appendChild(toolButton);
        });

        // Add export button
        const exportButton = document.createElement('button');
        exportButton.innerHTML = '💾';
        exportButton.title = 'Export Map (Ctrl+Shift+S)';
        exportButton.className = 'export-button';

        exportButton.addEventListener('click', () => {
            this.exportMap();
        });

        this.toolbarContainer.appendChild(exportButton);

        this.gameContainer.appendChild(this.toolbarContainer);
    }

    selectTool(tool) {
        // Reset all button styles
        const buttons = this.toolbarContainer.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.classList.remove('selected');
        });

        // Highlight selected tool
        const toolIndex = this.tools.findIndex(t => t.id === tool.id);
        if (toolIndex >= 0) {
            buttons[toolIndex].classList.add('selected');
        }

        this.selectedTool = tool;
    }

    setupMapClickHandler() {
        this.mapClickHandler = (e) => {
            if (!this.selectedTool) return;

            // Stop event propagation to prevent game click handler from firing
            e.stopPropagation();

            const rect = this.svg.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / window.TILE_SIZE);
            const y = Math.floor((e.clientY - rect.top) / window.TILE_SIZE);

            if (x >= 0 && x < MAP_WIDTH_TILES && y >= 0 && y < MAP_HEIGHT_TILES) {
                this.applyTool(x, y);
            }
        };

        this.svg.addEventListener('click', this.mapClickHandler);
    }

    removeMapClickHandler() {
        if (this.mapClickHandler) {
            this.svg.removeEventListener('click', this.mapClickHandler);
            this.mapClickHandler = null;
        }
    }

    applyTool(x, y) {
        if (!this.selectedTool) return;

        if (this.selectedTool.type === 'delete') {
            this.deleteTile(x, y);
        } else if (this.selectedTool.type === 'tile') {
            this.placeTile(x, y, this.selectedTool.tileType);
        } else if (this.selectedTool.type === 'resource') {
            this.placeResource(x, y, this.selectedTool.tileType);
        }

        // Redraw the map to show changes
        if (window.drawMap) {
            window.drawMap();
        }
    }

    deleteTile(x, y) {
        const tiles = map[y][x];
        if (tiles.length > 1) {
            // Remove the top layer (resource or tile)
            tiles.pop();
        }
    }

    placeTile(x, y, tileType) {
        const tiles = map[y][x];
        // Replace the top layer if it's not water, otherwise add a new layer
        if (tiles.length > 1 && tiles[tiles.length - 1] !== tileTypes.WATER) {
            tiles[tiles.length - 1] = tileType;
        } else {
            tiles.push(tileType);
        }
    }

    placeResource(x, y, resourceType) {
        // Use the existing function from map.js
        placeResourceAtPosition(x, y, resourceType);
    }

    exportMap() {
        // Convert current map state to JSON format
        const mapData = this.convertMapToJSON();

        // Create and download the file
        const dataStr = JSON.stringify(mapData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `map_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        console.log('Map exported successfully!');
    }

    convertMapToJSON() {
        const tiles = [];
        const resources = [];

        for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
            for (let x = 0; x < MAP_WIDTH_TILES; x++) {
                const tileLayers = map[y][x];
                if (tileLayers.length > 1) {
                    const layers = tileLayers.map(layer => {
                        if (layer === tileTypes.WATER) return 'WATER';
                        if (layer.color === '#3bbcff') return 'WATER_BORDER';
                        if (layer === tileTypes.GRASS) return 'GRASS';
                        if (layer === tileTypes.DIRT) return 'DIRT';
                        if (layer === tileTypes.LARGE_TREE) return 'LARGE_TREE';
                        if (layer === tileTypes.SMALL_TREE) return 'SMALL_TREE';
                        if (layer === tileTypes.ROCK) return 'ROCK';
                        if (layer === tileTypes.FLOWER) return 'FLOWER';
                        return 'WATER';
                    });

                    tiles.push({ x, y, layers });

                    // Check for resources
                    const topLayer = tileLayers[tileLayers.length - 1];
                    if (topLayer.resource) {
                        let resourceType = 'LARGE_TREE';
                        if (topLayer === tileTypes.SMALL_TREE) resourceType = 'SMALL_TREE';
                        else if (topLayer === tileTypes.ROCK) resourceType = 'ROCK';
                        else if (topLayer === tileTypes.FLOWER) resourceType = 'FLOWER';

                        resources.push({ type: resourceType, x, y });
                    }
                }
            }
        }

        return {
            width: MAP_WIDTH_TILES,
            height: MAP_HEIGHT_TILES,
            tiles,
            structures: [], // You can add structure detection here if needed
            resources,
            npcs: [], // You can add NPC detection here if needed
            chickens: [] // You can add chicken detection here if needed
        };
    }

    showEditorIndicator() {
        this.indicator = document.createElement('div');
        this.indicator.className = 'map-editor-indicator';
        this.indicator.textContent = 'Map Editor Active';
        document.body.appendChild(this.indicator);
    }

    hideEditorIndicator() {
        if (this.indicator) {
            document.body.removeChild(this.indicator);
            this.indicator = null;
        }
    }
} 