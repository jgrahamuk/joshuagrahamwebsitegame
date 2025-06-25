import { tileTypes, placeResourceAtPosition, removeResource, map, MAP_WIDTH_TILES, MAP_HEIGHT_TILES } from './map.js';
import { getSpriteUrl } from './spriteCache.js';
import { structures } from './structures.js';
import { NPC } from './npcs.js';
import { Chicken } from './chickens.js';

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
            { id: 'flower', name: 'Flower', icon: 'flower.png', type: 'resource', tileType: tileTypes.FLOWER },
            { id: 'egg', name: 'Egg', icon: 'egg.png', type: 'resource', tileType: tileTypes.EGG },
            { id: 'badge', name: 'Badge', icon: 'badge.png', type: 'resource', tileType: tileTypes.BADGE },
            // Structures
            { id: 'farmhouse', name: 'Farmhouse', icon: 'farmhouse.png', type: 'structure', structureType: 'FARMHOUSE', width: 10, height: 6 },
            { id: 'chicken_coop', name: 'Chicken Coop', icon: 'chicken-coop.png', type: 'structure', structureType: 'CHICKEN_COOP', width: 5, height: 3 },
            { id: 'sign', name: 'Sign', icon: 'sign-joshuagraham.png', type: 'structure', structureType: 'SIGN', width: 5, height: 3 },
            // NPCs
            { id: 'npc_joshua', name: 'Joshua NPC', icon: 'joshua-front.png', type: 'npc', npcType: 'Joshua', message: 'Welcome to my farm! It looks like the chickens are having a great time.' },
            // Chickens
            { id: 'chicken', name: 'Chicken', icon: 'chicken-front.png', type: 'chicken' }
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
            const offsetX = window.MAP_OFFSET_X || 0;
            const offsetY = window.MAP_OFFSET_Y || 0;

            // Calculate clicked position relative to map offset
            const x = Math.floor((e.clientX - rect.left - offsetX) / window.TILE_SIZE);
            const y = Math.floor((e.clientY - rect.top - offsetY) / window.TILE_SIZE);

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
        } else if (this.selectedTool.type === 'structure') {
            this.placeStructure(x, y, this.selectedTool);
        } else if (this.selectedTool.type === 'npc') {
            this.placeNPC(x, y, this.selectedTool);
            // Redraw the entire map to ensure NPCs are properly displayed
            window.drawMap();
            return;
        } else if (this.selectedTool.type === 'chicken') {
            this.placeChicken(x, y);
            // Redraw the entire map to ensure chickens are properly displayed
            window.drawMap();
            return;
        }

        // Update only the specific tile instead of redrawing the entire map
        this.updateTileDisplay(x, y);
    }

    updateTileDisplay(x, y) {
        // Get map offsets
        const offsetX = window.MAP_OFFSET_X || 0;
        const offsetY = window.MAP_OFFSET_Y || 0;

        // Calculate tile position with offsets
        const tileX = offsetX + x * window.TILE_SIZE;
        const tileY = offsetY + y * window.TILE_SIZE;

        // Remove existing images at this position more efficiently
        const imagesToRemove = [];
        const existingImages = this.svg.querySelectorAll('image');
        existingImages.forEach(img => {
            const imgX = parseFloat(img.getAttribute('x'));
            const imgY = parseFloat(img.getAttribute('y'));
            const imgWidth = parseFloat(img.getAttribute('width'));
            const imgHeight = parseFloat(img.getAttribute('height'));

            if (imgX === tileX && imgY === tileY && imgWidth === window.TILE_SIZE && imgHeight === window.TILE_SIZE) {
                imagesToRemove.push(img);
            }
        });

        // Remove the images
        imagesToRemove.forEach(img => img.remove());

        // Redraw the specific tile
        const tiles = map[y][x];
        let baseTile = tiles.find(t => t === tileTypes.DIRT) ? 'tile-dirt.png'
            : tiles.find(t => t === tileTypes.GRASS) ? 'tile-grass.png'
                : tiles.find(t => t === tileTypes.WATER || (t.color && t.color === '#3bbcff')) ? 'tile-water.png'
                    : 'tile-grass.png';

        const basePath = getSpriteUrl(baseTile);
        const imgBase = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imgBase.setAttribute('href', basePath);
        imgBase.setAttribute('x', tileX);
        imgBase.setAttribute('y', tileY);
        imgBase.setAttribute('width', window.TILE_SIZE);
        imgBase.setAttribute('height', window.TILE_SIZE);
        this.svg.appendChild(imgBase);

        // Add overlay if needed
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
            imgOverlay.setAttribute('href', getSpriteUrl(overlay));
            imgOverlay.setAttribute('x', tileX);
            imgOverlay.setAttribute('y', tileY);
            imgOverlay.setAttribute('width', window.TILE_SIZE);
            imgOverlay.setAttribute('height', window.TILE_SIZE);
            this.svg.appendChild(imgOverlay);
        }
    }

    deleteTile(x, y) {
        const tiles = map[y][x];
        let needsRedraw = false;

        // Check if this is a structure tile
        const isStructureTile = tiles.some(tile => tile.color === 'white' && !tile.passable);

        if (isStructureTile) {
            // Find and remove the entire structure
            this.removeStructureAt(x, y);
        } else if (tiles.length > 1) {
            // Remove the top layer (resource or tile)
            tiles.pop();
        }

        // Check if there's an NPC at this position
        if (window.npcs) {
            const npcIndex = window.npcs.findIndex(npc => npc.x === x && npc.y === y);
            if (npcIndex >= 0) {
                const npc = window.npcs[npcIndex];
                if (npc.element && npc.element.parentNode) {
                    npc.element.parentNode.removeChild(npc.element);
                }
                window.npcs.splice(npcIndex, 1);
                needsRedraw = true;
            }
        }

        // Check if there's a chicken at this position
        if (window.chickens) {
            const chickenIndex = window.chickens.findIndex(chicken => chicken.x === x && chicken.y === y);
            if (chickenIndex >= 0) {
                const chicken = window.chickens[chickenIndex];
                if (chicken.element && chicken.element.parentNode) {
                    chicken.element.parentNode.removeChild(chicken.element);
                }
                window.chickens.splice(chickenIndex, 1);
                needsRedraw = true;
            }
        }

        // If we deleted an NPC or chicken, redraw the entire map
        if (needsRedraw) {
            window.drawMap();
        } else {
            // Update only the specific tile instead of redrawing the entire map
            this.updateTileDisplay(x, y);
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

    placeStructure(x, y, tool) {
        // Check if there's enough space for the structure
        const width = tool.width;
        const height = tool.height;

        // Check if the area is clear
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                const checkX = x + dx;
                const checkY = y + dy;
                if (checkX >= MAP_WIDTH_TILES || checkY >= MAP_HEIGHT_TILES) {
                    return; // Structure would go out of bounds
                }
                const tiles = map[checkY][checkX];
                // Check if there's already a structure here
                if (tiles.some(tile => tile.color === 'white' && !tile.passable)) {
                    return; // Structure already exists here
                }
            }
        }

        // Place the structure
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                const placeX = x + dx;
                const placeY = y + dy;
                map[placeY][placeX].push({ color: 'white', passable: false, resource: null });
            }
        }

        // Update structure references
        const structureData = {
            type: tool.structureType,
            x: x,
            y: y,
            width: width,
            height: height
        };

        // Update global structure references
        if (tool.structureType === 'FARMHOUSE') {
            window.farmhouse = { x, y, w: width, h: height };
        } else if (tool.structureType === 'CHICKEN_COOP') {
            window.chickenCoop = { x, y, w: width, h: height };
        } else if (tool.structureType === 'SIGN') {
            window.signObj = { x, y, w: width, h: height };
        }

        // Redraw structures
        this.redrawStructures();
    }

    placeNPC(x, y, tool) {
        // Check if the tile is passable
        const tiles = map[y][x];
        const topTile = tiles[tiles.length - 1];
        if (!topTile.passable) {
            console.log('Cannot place NPC on impassable tile');
            return;
        }

        // Check if there's already an NPC at this position
        if (window.npcs && window.npcs.find(npc => npc.x === x && npc.y === y)) {
            console.log('NPC already exists at this position');
            return; // NPC already exists at this position
        }

        // Create NPC
        const npc = new NPC(this.svg, tool.npcType, tool.message, x, y);

        // Add to global NPCs array
        if (!window.npcs) window.npcs = [];
        window.npcs.push(npc);

        // Ensure the NPC is visible by redrawing it
        npc.updatePosition();

        console.log(`NPC ${tool.npcType} placed at (${x}, ${y}). Total NPCs: ${window.npcs.length}`);
    }

    placeChicken(x, y) {
        // Check if the tile is passable
        const tiles = map[y][x];
        const topTile = tiles[tiles.length - 1];
        if (!topTile.passable) {
            console.log('Cannot place chicken on impassable tile');
            return;
        }

        // Check if there's already a chicken at this position
        if (window.chickens && window.chickens.find(chicken => chicken.x === x && chicken.y === y)) {
            console.log('Chicken already exists at this position');
            return; // Chicken already exists at this position
        }

        // Create chicken at the specified position
        const chicken = new Chicken(this.svg, x, y);

        // Add to global chickens array
        if (!window.chickens) window.chickens = [];
        window.chickens.push(chicken);

        console.log(`Chicken placed at (${x}, ${y}). Total chickens: ${window.chickens.length}`);
    }

    removeStructureAt(x, y) {
        // Find which structure this tile belongs to
        let structureFound = false;

        // Check farmhouse
        if (window.farmhouse && this.isInStructure(x, y, window.farmhouse)) {
            this.removeStructure(window.farmhouse, 'FARMHOUSE');
            window.farmhouse = null;
            structureFound = true;
        }

        // Check chicken coop
        if (!structureFound && window.chickenCoop && this.isInStructure(x, y, window.chickenCoop)) {
            this.removeStructure(window.chickenCoop, 'CHICKEN_COOP');
            window.chickenCoop = null;
            structureFound = true;
        }

        // Check sign
        if (!structureFound && window.signObj && this.isInStructure(x, y, window.signObj)) {
            this.removeStructure(window.signObj, 'SIGN');
            window.signObj = null;
            structureFound = true;
        }
    }

    isInStructure(x, y, structure) {
        return x >= structure.x && x < structure.x + structure.w &&
            y >= structure.y && y < structure.y + structure.h;
    }

    removeStructure(structure, type) {
        // Remove all tiles of the structure
        for (let dy = 0; dy < structure.h; dy++) {
            for (let dx = 0; dx < structure.w; dx++) {
                const removeX = structure.x + dx;
                const removeY = structure.y + dy;
                if (removeX < MAP_WIDTH_TILES && removeY < MAP_HEIGHT_TILES) {
                    const tiles = map[removeY][removeX];
                    // Remove structure tiles (white, impassable)
                    for (let i = tiles.length - 1; i >= 0; i--) {
                        if (tiles[i].color === 'white' && !tiles[i].passable) {
                            tiles.splice(i, 1);
                        }
                    }
                }
            }
        }

        // Redraw structures
        this.redrawStructures();
    }

    redrawStructures() {
        // Remove existing structure images
        const existingStructures = this.svg.querySelectorAll('image');
        existingStructures.forEach(img => {
            const href = img.getAttribute('href');
            if (href && (href.includes('farmhouse') || href.includes('chicken-coop') || href.includes('sign-joshuagraham'))) {
                img.remove();
            }
        });

        // Redraw structures
        if (window.farmhouse) {
            const imgFarm = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imgFarm.setAttribute('href', getSpriteUrl('farmhouse.png'));
            imgFarm.setAttribute('x', window.farmhouse.x * window.TILE_SIZE);
            imgFarm.setAttribute('y', window.farmhouse.y * window.TILE_SIZE);
            imgFarm.setAttribute('width', window.farmhouse.w * window.TILE_SIZE);
            imgFarm.setAttribute('height', window.farmhouse.h * window.TILE_SIZE);
            this.svg.appendChild(imgFarm);
        }

        if (window.chickenCoop) {
            const imgCoop = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imgCoop.setAttribute('href', getSpriteUrl('chicken-coop.png'));
            imgCoop.setAttribute('x', window.chickenCoop.x * window.TILE_SIZE);
            imgCoop.setAttribute('y', window.chickenCoop.y * window.TILE_SIZE);
            imgCoop.setAttribute('width', window.chickenCoop.w * window.TILE_SIZE);
            imgCoop.setAttribute('height', window.chickenCoop.h * window.TILE_SIZE);
            this.svg.appendChild(imgCoop);
        }

        if (window.signObj) {
            const imgSign = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imgSign.setAttribute('href', getSpriteUrl('sign-joshuagraham.png'));
            imgSign.setAttribute('x', window.signObj.x * window.TILE_SIZE);
            imgSign.setAttribute('y', window.signObj.y * window.TILE_SIZE);
            imgSign.setAttribute('width', window.signObj.w * window.TILE_SIZE);
            imgSign.setAttribute('height', window.signObj.h * window.TILE_SIZE);
            this.svg.appendChild(imgSign);
        }
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
        const structures = [];
        const npcs = [];
        const chickens = [];

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
                        if (layer === tileTypes.EGG) return 'EGG';
                        if (layer === tileTypes.BADGE) return 'BADGE';
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
                        else if (topLayer === tileTypes.EGG) resourceType = 'EGG';
                        else if (topLayer === tileTypes.BADGE) resourceType = 'BADGE';

                        resources.push({ type: resourceType, x, y });
                    }
                }
            }
        }

        // Add structures
        if (window.farmhouse) {
            structures.push({
                type: 'FARMHOUSE',
                x: window.farmhouse.x,
                y: window.farmhouse.y,
                width: window.farmhouse.w,
                height: window.farmhouse.h
            });
        }
        if (window.chickenCoop) {
            structures.push({
                type: 'CHICKEN_COOP',
                x: window.chickenCoop.x,
                y: window.chickenCoop.y,
                width: window.chickenCoop.w,
                height: window.chickenCoop.h
            });
        }
        if (window.signObj) {
            structures.push({
                type: 'SIGN',
                x: window.signObj.x,
                y: window.signObj.y,
                width: window.signObj.w,
                height: window.signObj.h
            });
        }

        // Add NPCs
        if (window.npcs) {
            window.npcs.forEach(npc => {
                npcs.push({
                    name: npc.name,
                    x: npc.x,
                    y: npc.y,
                    message: npc.message
                });
            });
        }

        // Add chickens
        if (window.chickens) {
            window.chickens.forEach(chicken => {
                chickens.push({
                    x: chicken.x,
                    y: chicken.y
                });
            });
        }

        return {
            width: MAP_WIDTH_TILES,
            height: MAP_HEIGHT_TILES,
            tiles,
            structures,
            resources,
            npcs,
            chickens
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