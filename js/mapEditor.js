import { tileTypes, placeResourceAtPosition, removeResource, map, MAP_WIDTH_TILES, MAP_HEIGHT_TILES } from './map.js';
import { getSpriteUrl } from './spriteCache.js';
import { NPC } from './npcs.js';
import { Chicken, Cockerel } from './chickens.js';
import { loadMapData, convertMapDataToGameFormat } from './mapLoader.js';
import { initializeMap } from './map.js';

export class MapEditor {
    constructor(svg, gameContainer) {
        this.svg = svg;
        this.gameContainer = gameContainer;
        this.isActive = false;
        this.selectedTool = null;
        this.toolbar = null;
        this.toolbarContainer = null;
        this.isEditingPortrait = false;
        this.originalMapData = null;
        this.isDragging = false;
        this.lastTileX = null;
        this.lastTileY = null;

        this.tools = [
            { id: 'delete', name: 'Delete', icon: '🗑️', type: 'delete' },
            { id: 'grass', name: 'Grass', icon: 'tile-grass.gif', type: 'tile', tileType: tileTypes.GRASS },
            { id: 'dirt', name: 'Dirt', icon: 'tile-dirt.gif', type: 'tile', tileType: tileTypes.DIRT },
            { id: 'water', name: 'Water', icon: 'tile-water.gif', type: 'tile', tileType: tileTypes.WATER },
            { id: 'large_tree', name: 'Large Tree', icon: 'tree.gif', type: 'resource', tileType: tileTypes.LARGE_TREE },
            { id: 'bush', name: 'Bush', icon: 'bush.gif', type: 'resource', tileType: tileTypes.BUSH },
            { id: 'pine_tree', name: 'Pine Tree', icon: 'pine-tree.gif', type: 'resource', tileType: tileTypes.PINE_TREE },
            { id: 'rock', name: 'Rock', icon: 'stone.gif', type: 'resource', tileType: tileTypes.ROCK },
            { id: 'flower', name: 'Flower', icon: 'flower.gif', type: 'resource', tileType: tileTypes.FLOWER },
            { id: 'egg', name: 'Egg', icon: 'egg.gif', type: 'resource', tileType: tileTypes.EGG },
            { id: 'badge', name: 'Badge', icon: 'badge.gif', type: 'resource', tileType: tileTypes.BADGE },
            // Structures
            { id: 'farmhouse', name: 'Farmhouse', icon: 'farmhouse.gif', type: 'structure', structureType: 'FARMHOUSE', width: 10, height: 6 },
            { id: 'chicken_coop', name: 'Chicken Coop', icon: 'chicken-coop.gif', type: 'structure', structureType: 'CHICKEN_COOP', width: 5, height: 3 },
            { id: 'sign', name: 'Sign', icon: 'sign-joshuagraham.gif', type: 'structure', structureType: 'SIGN', width: 5, height: 3 },
            // NPCs
            { id: 'npc_joshua', name: 'Joshua NPC', icon: 'joshua-front.gif', type: 'npc', npcType: 'Joshua', message: 'Welcome to my farm! It looks like the chickens are having a great time.' },
            // Chickens and Cockerels
            { id: 'chicken', name: 'Chicken', icon: 'chicken-front.gif', type: 'chicken' },
            { id: 'cockerel', name: 'Cockerel', icon: 'cockerel-front.gif', type: 'cockerel' }
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

        // If we were editing the portrait map, switch back to landscape if appropriate
        if (this.isEditingPortrait) {
            const aspectRatio = window.innerWidth / window.innerHeight;
            if (aspectRatio > 1) {  // If we're in landscape orientation
                this.restoreOriginalMap();
            }
        }

        // Clear saved state
        this.originalMapData = null;
        this.isEditingPortrait = false;
    }

    createToolbar() {
        this.toolbarContainer = document.createElement('div');
        this.toolbarContainer.id = 'map-editor-toolbar';

        // Add map mode toggle button first
        const modeToggleButton = document.createElement('button');
        modeToggleButton.innerHTML = '📱';
        modeToggleButton.title = 'Toggle Portrait/Landscape Map';
        modeToggleButton.className = 'mode-toggle-button' + (this.isEditingPortrait ? ' selected' : '');
        modeToggleButton.addEventListener('click', () => {
            this.toggleMapMode();
        });
        this.toolbarContainer.appendChild(modeToggleButton);

        // Add existing tools
        this.tools.forEach(tool => {
            const toolButton = document.createElement('button');

            if (tool.icon.endsWith('.gif')) {
                const img = document.createElement('img');
                img.src = getSpriteUrl(tool.icon);
                toolButton.appendChild(img);
            } else {
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
            if (!btn.classList.contains('mode-toggle-button') &&
                !btn.classList.contains('export-button')) {
                btn.classList.remove('selected');
            }
        });

        // Find the button for this tool and highlight it
        const toolIndex = this.tools.findIndex(t => t.id === tool.id);
        if (toolIndex >= 0) {
            // Add 1 to account for the mode toggle button at the start
            const buttonIndex = toolIndex + 1;
            const button = buttons[buttonIndex];
            if (button) {
                button.classList.add('selected');
            }
        }

        this.selectedTool = tool;
    }

    setupMapClickHandler() {
        // Create bound event handlers that we can properly remove later
        this.handleMouseDown = (e) => {
            if (!this.selectedTool) return;
            this.isDragging = true;
            this.handleMapInteraction(e);
        };

        this.handleMouseMove = (e) => {
            if (!this.isDragging || !this.selectedTool) return;
            this.handleMapInteraction(e);
        };

        this.handleMouseUp = () => {
            this.isDragging = false;
            this.lastTileX = null;
            this.lastTileY = null;
        };

        this.mapClickHandler = (e) => {
            if (!this.selectedTool) return;
            e.stopPropagation();
            this.handleMapInteraction(e);
        };

        // Add all event listeners
        this.svg.addEventListener('mousedown', this.handleMouseDown);
        this.svg.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
        this.svg.addEventListener('click', this.mapClickHandler);
    }

    handleMapInteraction(e) {
        const rect = this.svg.getBoundingClientRect();
        const offsetX = window.MAP_OFFSET_X || 0;
        const offsetY = window.MAP_OFFSET_Y || 0;

        // Calculate clicked position relative to map offset
        const x = Math.floor((e.clientX - rect.left - offsetX) / window.TILE_SIZE);
        const y = Math.floor((e.clientY - rect.top - offsetY) / window.TILE_SIZE);

        // Check if we're within map bounds
        if (x >= 0 && x < MAP_WIDTH_TILES && y >= 0 && y < MAP_HEIGHT_TILES) {
            // Only apply the tool if this is a new tile position
            if (x !== this.lastTileX || y !== this.lastTileY) {
                this.applyTool(x, y);
                this.lastTileX = x;
                this.lastTileY = y;
            }
        }
    }

    removeMapClickHandler() {
        if (this.mapClickHandler) {
            this.svg.removeEventListener('click', this.mapClickHandler);
            this.svg.removeEventListener('mousedown', this.handleMouseDown);
            this.svg.removeEventListener('mousemove', this.handleMouseMove);
            document.removeEventListener('mouseup', this.handleMouseUp);
            this.mapClickHandler = null;
            this.handleMouseDown = null;
            this.handleMouseMove = null;
            this.handleMouseUp = null;
        }
        // Reset drag state
        this.isDragging = false;
        this.lastTileX = null;
        this.lastTileY = null;
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
        } else if (this.selectedTool.type === 'cockerel') {
            this.placeCockerel(x, y);
            // Redraw the entire map to ensure cockerels are properly displayed
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

            // Only remove images that are exactly at this tile position
            // and don't have a data-resource attribute (base tiles only)
            if (imgX === tileX && imgY === tileY && !img.hasAttribute('data-resource')) {
                imagesToRemove.push(img);
            }
        });

        // Remove the base tile images
        imagesToRemove.forEach(img => img.remove());

        // Remove any existing resource at this position
        const existingResources = this.svg.querySelectorAll('image[data-resource]');
        existingResources.forEach(img => {
            const imgX = parseFloat(img.getAttribute('x'));
            const imgY = parseFloat(img.getAttribute('y'));
            const imgWidth = parseFloat(img.getAttribute('width'));
            const imgHeight = parseFloat(img.getAttribute('height'));

            // Check if this resource's center point is in our tile
            const resourceCenterX = imgX + imgWidth / 2;
            const resourceCenterY = imgY + imgHeight / 2;
            const tileCenterX = tileX + window.TILE_SIZE / 2;
            const tileCenterY = tileY + window.TILE_SIZE / 2;

            if (Math.abs(resourceCenterX - tileCenterX) < window.TILE_SIZE / 2 &&
                Math.abs(resourceCenterY - tileCenterY) < window.TILE_SIZE / 2) {
                img.remove();
            }
        });

        // Redraw the specific tile
        const tiles = map[y][x];
        let baseTile = tiles.find(t => t === tileTypes.DIRT) ? 'tile-dirt.gif'
            : tiles.find(t => t === tileTypes.GRASS) ? 'tile-grass.gif'
                : tiles.find(t => t === tileTypes.WATER || (t.color && t.color === '#3bbcff')) ? 'tile-water.gif'
                    : 'tile-grass.gif';

        const basePath = getSpriteUrl(baseTile);
        const imgBase = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imgBase.setAttribute('href', basePath);
        imgBase.setAttribute('x', tileX);
        imgBase.setAttribute('y', tileY);
        imgBase.setAttribute('width', window.TILE_SIZE);
        imgBase.setAttribute('height', window.TILE_SIZE);
        imgBase.style.imageRendering = 'pixelated';
        // Set a low z-index for base tiles
        imgBase.style.zIndex = '1';
        this.svg.appendChild(imgBase);

        // Add overlay if needed
        const top = tiles[tiles.length - 1];
        let overlay = null;
        let scale = 1;

        if (top === tileTypes.LARGE_TREE) {
            overlay = 'tree.gif';
            scale = 2;
        } else if (top === tileTypes.BUSH) {
            overlay = 'bush.gif';
        } else if (top === tileTypes.PINE_TREE) {
            overlay = 'pine-tree.gif';
            scale = 2;
        } else if (top === tileTypes.ROCK) {
            overlay = 'stone.gif';
        } else if (top === tileTypes.FLOWER) {
            overlay = 'flower.gif';
        } else if (top === tileTypes.EGG) {
            overlay = 'egg.gif';
        } else if (top === tileTypes.BADGE) {
            overlay = 'badge.gif';
        }

        if (overlay) {
            const imgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imgOverlay.setAttribute('href', getSpriteUrl(overlay));
            imgOverlay.setAttribute('data-resource', 'true');

            // For scaled resources, adjust position to keep centered
            if (scale > 1) {
                const offset = (window.TILE_SIZE * (scale - 1)) / 2;
                imgOverlay.setAttribute('x', tileX - offset);
                imgOverlay.setAttribute('y', tileY - offset);
                imgOverlay.setAttribute('width', window.TILE_SIZE * scale);
                imgOverlay.setAttribute('height', window.TILE_SIZE * scale);
            } else {
                imgOverlay.setAttribute('x', tileX);
                imgOverlay.setAttribute('y', tileY);
                imgOverlay.setAttribute('width', window.TILE_SIZE);
                imgOverlay.setAttribute('height', window.TILE_SIZE);
            }

            imgOverlay.style.imageRendering = 'pixelated';
            // Set a higher z-index for resources
            imgOverlay.style.zIndex = '2';
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

    placeCockerel(x, y) {
        // Check if the tile is passable
        const tiles = map[y][x];
        const topTile = tiles[tiles.length - 1];
        if (!topTile.passable) {
            console.log('Cannot place cockerel on impassable tile');
            return;
        }

        // Check if there's already a cockerel at this position
        if (window.cockerels && window.cockerels.find(cockerel => cockerel.x === x && cockerel.y === y)) {
            console.log('Cockerel already exists at this position');
            return;
        }

        // Create cockerel at the specified position
        const cockerel = new Cockerel(this.svg, x, y);

        // Add to global cockerels array
        if (!window.cockerels) window.cockerels = [];
        window.cockerels.push(cockerel);

        console.log(`Cockerel placed at (${x}, ${y}). Total cockerels: ${window.cockerels.length}`);
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
            imgFarm.setAttribute('href', getSpriteUrl('farmhouse.gif'));
            imgFarm.setAttribute('x', window.farmhouse.x * window.TILE_SIZE);
            imgFarm.setAttribute('y', window.farmhouse.y * window.TILE_SIZE);
            imgFarm.setAttribute('width', window.farmhouse.w * window.TILE_SIZE);
            imgFarm.setAttribute('height', window.farmhouse.h * window.TILE_SIZE);
            this.svg.appendChild(imgFarm);
        }

        if (window.chickenCoop) {
            const imgCoop = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imgCoop.setAttribute('href', getSpriteUrl('chicken-coop.gif'));
            imgCoop.setAttribute('x', window.chickenCoop.x * window.TILE_SIZE);
            imgCoop.setAttribute('y', window.chickenCoop.y * window.TILE_SIZE);
            imgCoop.setAttribute('width', window.chickenCoop.w * window.TILE_SIZE);
            imgCoop.setAttribute('height', window.chickenCoop.h * window.TILE_SIZE);
            this.svg.appendChild(imgCoop);
        }

        if (window.signObj) {
            const imgSign = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            imgSign.setAttribute('href', getSpriteUrl('sign-joshuagraham.gif'));
            imgSign.setAttribute('x', window.signObj.x * window.TILE_SIZE);
            imgSign.setAttribute('y', window.signObj.y * window.TILE_SIZE);
            imgSign.setAttribute('width', window.signObj.w * window.TILE_SIZE);
            imgSign.setAttribute('height', window.signObj.h * window.TILE_SIZE);
            this.svg.appendChild(imgSign);
        }
    }

    async toggleMapMode() {
        const modeButton = this.toolbarContainer.querySelector('.mode-toggle-button');
        this.isEditingPortrait = !this.isEditingPortrait;
        modeButton.classList.toggle('selected', this.isEditingPortrait);

        try {
            await initializeMap(this.isEditingPortrait);
            window.drawMap(this.svg);

        } catch (error) {
            console.error('Error loading map:', error);
            alert('Failed to load map. Check console for details.');
        }
    }

    convertMapDataToGameFormat(mapData) {
        // Initialize empty map array
        const gameMap = Array(mapData.height).fill().map(() =>
            Array(mapData.width).fill().map(() => [tileTypes.GRASS])
        );

        // Apply tile layers
        mapData.tiles.forEach(tile => {
            gameMap[tile.y][tile.x] = tile.layers.map(layer => {
                switch (layer) {
                    case 'WATER': return tileTypes.WATER;
                    case 'WATER_BORDER': return { color: '#3bbcff', passable: false };
                    case 'GRASS': return tileTypes.GRASS;
                    case 'DIRT': return tileTypes.DIRT;
                    case 'LARGE_TREE': return tileTypes.LARGE_TREE;
                    case 'BUSH': return tileTypes.BUSH;
                    case 'PINE_TREE': return tileTypes.PINE_TREE;
                    case 'ROCK': return tileTypes.ROCK;
                    case 'FLOWER': return tileTypes.FLOWER;
                    case 'EGG': return tileTypes.EGG;
                    case 'BADGE': return tileTypes.BADGE;
                    default: return tileTypes.GRASS;
                }
            });
        });

        // Apply structure tiles
        mapData.structures.forEach(structure => {
            for (let y = structure.y; y < structure.y + structure.height; y++) {
                for (let x = structure.x; x < structure.x + structure.width; x++) {
                    if (y < mapData.height && x < mapData.width) {
                        gameMap[y][x].push({ color: 'white', passable: false, resource: null });
                    }
                }
            }
        });

        return {
            map: gameMap,
            structures: mapData.structures,
            npcs: mapData.npcs || [],
            chickens: mapData.chickens || [],
            cockerels: mapData.cockerels || []
        };
    }

    async saveCurrentMapState() {
        return {
            map: JSON.parse(JSON.stringify(window.map)),
            width: window.MAP_WIDTH_TILES,
            height: window.MAP_HEIGHT_TILES,
            farmhouse: window.farmhouse ? { ...window.farmhouse } : null,
            chickenCoop: window.chickenCoop ? { ...window.chickenCoop } : null,
            signObj: window.signObj ? { ...window.signObj } : null,
            npcs: window.npcs ? window.npcs.map(npc => ({
                name: npc.name,
                message: npc.message,
                x: npc.x,
                y: npc.y
            })) : [],
            chickens: window.chickens ? window.chickens.map(chicken => ({
                x: chicken.x,
                y: chicken.y
            })) : [],
            cockerels: window.cockerels ? window.cockerels.map(cockerel => ({
                x: cockerel.x,
                y: cockerel.y
            })) : []
        };
    }

    async restoreOriginalMap() {
        if (this.originalMapData) {
            // Restore map dimensions
            window.MAP_WIDTH_TILES = this.originalMapData.width;
            window.MAP_HEIGHT_TILES = this.originalMapData.height;

            // Restore map data
            window.map = this.originalMapData.map;

            // Restore structures
            window.farmhouse = this.originalMapData.farmhouse;
            window.chickenCoop = this.originalMapData.chickenCoop;
            window.signObj = this.originalMapData.signObj;

            // Restore NPCs and chickens
            window.npcs = this.originalMapData.npcs.map(npc => new NPC(this.svg, npc.name, npc.message, npc.x, npc.y));
            window.chickens = this.originalMapData.chickens.map(chicken => new Chicken(this.svg, chicken.x, chicken.y));
            window.cockerels = this.originalMapData.cockerels.map(cockerel => new Cockerel(this.svg, cockerel.x, cockerel.y));

            // Redraw the map
            window.drawMap();
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
        // Use appropriate filename based on which map we're editing
        link.download = this.isEditingPortrait ? 'map-portrait.json' : 'map.json';
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
                        if (layer === tileTypes.BUSH) return 'BUSH';
                        if (layer === tileTypes.PINE_TREE) return 'PINE_TREE';
                        if (layer === tileTypes.ROCK) return 'ROCK';
                        if (layer === tileTypes.FLOWER) return 'FLOWER';
                        if (layer === tileTypes.EGG) return 'EGG';
                        if (layer === tileTypes.BADGE) return 'BADGE';
                        return 'WATER';
                    });

                    tiles.push({ x, y, layers });

                    // Check for resources
                    const topLayer = tileLayers[tileLayers.length - 1];
                    if (topLayer === tileTypes.LARGE_TREE ||
                        topLayer === tileTypes.BUSH ||
                        topLayer === tileTypes.PINE_TREE ||
                        topLayer === tileTypes.ROCK ||
                        topLayer === tileTypes.FLOWER ||
                        topLayer === tileTypes.EGG ||
                        topLayer === tileTypes.BADGE) {
                        let resourceType = 'LARGE_TREE';
                        if (topLayer === tileTypes.BUSH) resourceType = 'BUSH';
                        else if (topLayer === tileTypes.PINE_TREE) resourceType = 'PINE_TREE';
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