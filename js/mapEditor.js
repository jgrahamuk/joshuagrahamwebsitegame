import { tileTypes, placeResourceAtPosition, removeResource, map, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, replaceMap } from './map.js';
import { getSpriteUrl } from './spriteCache.js';
import { NPC } from './npcs.js';
import { Chicken, Cockerel, canPlaceHen, canPlaceRooster } from './chickens.js';
import { saveMapToSupabase } from './mapBrowser.js';
import { getCurrentUser } from './auth.js';
import { isConfigured, getSupabase } from './supabase.js';
import { collectablesSystem } from './collectables.js';
import { imageTilesSystem } from './imageTiles.js';
import { getUserTier, isPaidTool, TIERS } from './tiers.js';
import { config } from './config.js';

export class MapEditor {
    constructor(svg, gameContainer) {
        this.svg = svg;
        this.gameContainer = gameContainer;
        this.isActive = false;
        this.selectedTool = null;
        this.toolbar = null;
        this.toolbarContainer = null;
        this.isDragging = false;
        this.lastTileX = null;
        this.lastTileY = null;
        this.autoSaveTimeout = null;
        this.isSaving = false;

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
            // NPCs
            { id: 'npc_joshua', name: 'Joshua NPC', icon: 'joshua-front.gif', type: 'npc', npcType: 'Joshua', message: 'Welcome to my farm! It looks like the chickens are having a great time.' },
            // Chickens and Cockerels
            { id: 'chicken', name: 'Chicken', icon: 'chicken-front.gif', type: 'chicken' },
            { id: 'cockerel', name: 'Cockerel', icon: 'cockerel-front.gif', type: 'cockerel' },
            // Image tile
            { id: 'image', name: 'Image', icon: '🖼️', type: 'image', tileType: tileTypes.IMAGE }
        ];

        // Tool groups for the toolbar flyout UI
        this.toolGroups = [
            { id: 'delete', label: 'Delete', toolIds: ['delete'], standalone: true },
            { id: 'terrain', label: 'Terrain', toolIds: ['grass', 'dirt', 'water'] },
            { id: 'nature', label: 'Nature', toolIds: ['large_tree', 'bush', 'pine_tree', 'rock', 'flower'] },
            { id: 'collectables', label: 'Collectables', toolIds: ['egg', 'badge'] },
            { id: 'buildings', label: 'Buildings', toolIds: ['farmhouse', 'chicken_coop'] },
            { id: 'creatures', label: 'Creatures', toolIds: ['chicken', 'cockerel'] },
            { id: 'npcs', label: 'NPCs', toolIds: ['npc_joshua'], standalone: true },
            { id: 'image', label: 'Image', toolIds: ['image'], standalone: true },
        ];

        // Track which tool is the "primary" (visible) for each group
        this.groupPrimaries = {};
        this.toolGroups.forEach(g => {
            this.groupPrimaries[g.id] = g.toolIds[0];
        });

        // Currently expanded flyout group id
        this.expandedGroup = null;

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

        // Hide inventory UI when editing
        const uiContainer = document.getElementById('ui-container');
        if (uiContainer) {
            uiContainer.style.display = 'none';
        }
    }

    hideToolbar() {
        this.isActive = false;
        this.selectedTool = null;
        this.expandedGroup = null;
        if (this._documentClickHandler) {
            document.removeEventListener('click', this._documentClickHandler);
            this._documentClickHandler = null;
        }
        if (this.toolbarContainer) {
            this.gameContainer.removeChild(this.toolbarContainer);
            this.toolbarContainer = null;
        }
        this.removeMapClickHandler();

        // Show inventory UI when done editing
        const uiContainer = document.getElementById('ui-container');
        if (uiContainer) {
            uiContainer.style.display = '';
        }
    }

    createToolButton(tool, userTier) {
        const toolButton = document.createElement('button');
        toolButton.setAttribute('data-tool-id', tool.id);
        const locked = isPaidTool(tool.id) && userTier !== TIERS.PAID;

        if (tool.icon.endsWith('.gif')) {
            const img = document.createElement('img');
            img.src = getSpriteUrl(tool.icon);
            toolButton.appendChild(img);
        } else {
            toolButton.innerHTML = tool.icon;
        }

        if (locked) {
            toolButton.classList.add('tool-locked');
            const lockBadge = document.createElement('span');
            lockBadge.className = 'tool-lock-badge';
            lockBadge.textContent = '\u{1F512}';
            toolButton.appendChild(lockBadge);
            toolButton.title = `${tool.name} (Paid)`;
        } else {
            toolButton.title = tool.name;
        }

        return { toolButton, locked };
    }

    setButtonContent(button, tool, userTier) {
        const locked = isPaidTool(tool.id) && userTier !== TIERS.PAID;
        button.innerHTML = '';
        button.setAttribute('data-tool-id', tool.id);

        if (tool.icon.endsWith('.gif')) {
            const img = document.createElement('img');
            img.src = getSpriteUrl(tool.icon);
            button.appendChild(img);
        } else {
            button.innerHTML = tool.icon;
        }

        if (locked) {
            button.classList.add('tool-locked');
            const lockBadge = document.createElement('span');
            lockBadge.className = 'tool-lock-badge';
            lockBadge.textContent = '\u{1F512}';
            button.appendChild(lockBadge);
            button.title = `${tool.name} (Paid)`;
        } else {
            button.classList.remove('tool-locked');
            button.title = tool.name;
        }
    }

    collapseAllFlyouts() {
        this.expandedGroup = null;
        if (!this.toolbarContainer) return;
        this.toolbarContainer.querySelectorAll('.tool-group-flyout').forEach(f => {
            f.style.display = 'none';
        });
    }

    createToolbar() {
        this.toolbarContainer = document.createElement('div');
        this.toolbarContainer.id = 'map-editor-toolbar';

        const userTier = getUserTier();

        this.toolGroups.forEach(group => {
            const toolsInGroup = group.toolIds.map(id => this.tools.find(t => t.id === id));
            const primaryToolId = this.groupPrimaries[group.id];
            const primaryTool = this.tools.find(t => t.id === primaryToolId);

            if (group.standalone) {
                // Standalone: single button, no flyout
                const { toolButton, locked } = this.createToolButton(primaryTool, userTier);
                toolButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.collapseAllFlyouts();
                    if (locked) {
                        this.showUpgradePrompt(primaryTool.name);
                        return;
                    }
                    this.selectTool(primaryTool);
                });
                this.toolbarContainer.appendChild(toolButton);
            } else {
                // Multi-tool group with flyout
                const wrapper = document.createElement('div');
                wrapper.className = 'tool-group';
                wrapper.setAttribute('data-group-id', group.id);

                // Primary button (always visible)
                const { toolButton: primaryBtn } = this.createToolButton(primaryTool, userTier);
                primaryBtn.classList.add('tool-group-primary');
                primaryBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.expandedGroup === group.id) {
                        // Already open - collapse
                        this.collapseAllFlyouts();
                    } else {
                        this.collapseAllFlyouts();
                        this.expandedGroup = group.id;
                        flyout.style.display = 'flex';
                    }
                    // Auto-select the primary tool (force — don't toggle off)
                    const currentPrimaryId = this.groupPrimaries[group.id];
                    const currentPrimary = this.tools.find(t => t.id === currentPrimaryId);
                    const locked = isPaidTool(currentPrimary.id) && userTier !== TIERS.PAID;
                    if (locked) {
                        this.showUpgradePrompt(currentPrimary.name);
                        return;
                    }
                    this.selectTool(currentPrimary, true);
                });
                wrapper.appendChild(primaryBtn);

                // Flyout container (hidden by default via inline style)
                const flyout = document.createElement('div');
                flyout.className = 'tool-group-flyout';
                flyout.style.display = 'none';

                toolsInGroup.forEach(tool => {
                    const { toolButton: flyBtn, locked } = this.createToolButton(tool, userTier);
                    flyBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (locked) {
                            this.showUpgradePrompt(tool.name);
                            return;
                        }
                        // Update group primary
                        this.groupPrimaries[group.id] = tool.id;
                        this.setButtonContent(primaryBtn, tool, userTier);
                        primaryBtn.classList.add('tool-group-primary');
                        this.selectTool(tool, true);
                        this.collapseAllFlyouts();
                    });
                    flyout.appendChild(flyBtn);
                });

                wrapper.appendChild(flyout);
                this.toolbarContainer.appendChild(wrapper);
            }
        });

        // Add intro text button
        const introButton = document.createElement('button');
        introButton.innerHTML = '💬';
        introButton.title = 'Edit Welcome Message';
        introButton.className = 'export-button intro-button';
        introButton.addEventListener('click', () => {
            this.collapseAllFlyouts();
            this.showIntroTextDialog();
        });
        this.toolbarContainer.appendChild(introButton);

        // Add page title button
        const titleButton = document.createElement('button');
        titleButton.innerHTML = '📝';
        titleButton.title = 'Edit Page Title';
        titleButton.className = 'export-button title-button';
        titleButton.addEventListener('click', () => {
            this.collapseAllFlyouts();
            this.showPageTitleDialog();
        });
        this.toolbarContainer.appendChild(titleButton);

        // Close flyouts when clicking outside
        this._documentClickHandler = (e) => {
            if (this.expandedGroup && !e.target.closest('.tool-group')) {
                this.collapseAllFlyouts();
            }
        };
        document.addEventListener('click', this._documentClickHandler);

        this.gameContainer.appendChild(this.toolbarContainer);
    }

    selectTool(tool, forceSelect = false) {
        // If clicking on already selected tool, deselect it (unless forced)
        if (!forceSelect && this.selectedTool && this.selectedTool.id === tool.id) {
            this.selectedTool = null;
            this.toolbarContainer.querySelectorAll('button.selected').forEach(btn => {
                btn.classList.remove('selected');
            });
            return;
        }

        // Reset all button styles
        this.toolbarContainer.querySelectorAll('button.selected').forEach(btn => {
            btn.classList.remove('selected');
        });

        // Highlight the matching tool button(s) — both flyout button and primary button
        // Find the group this tool belongs to
        const group = this.toolGroups.find(g => g.toolIds.includes(tool.id));
        if (group && !group.standalone) {
            // Highlight the primary button for the group
            const wrapper = this.toolbarContainer.querySelector(`.tool-group[data-group-id="${group.id}"]`);
            if (wrapper) {
                const primaryBtn = wrapper.querySelector('.tool-group-primary');
                if (primaryBtn) primaryBtn.classList.add('selected');
            }
        } else {
            // Standalone tool — highlight the button directly
            const btn = this.toolbarContainer.querySelector(`button[data-tool-id="${tool.id}"]`);
            if (btn) btn.classList.add('selected');
        }

        this.selectedTool = tool;
    }

    setupMapClickHandler() {
        // Create bound event handlers that we can properly remove later
        this.handleMouseDown = (e) => {
            if (!this.selectedTool) return;

            // Check if clicking on same resource type - skip to allow double-click
            const rect = this.svg.getBoundingClientRect();
            const offsetX = window.MAP_OFFSET_X || 0;
            const offsetY = window.MAP_OFFSET_Y || 0;
            const x = Math.floor((e.clientX - rect.left - offsetX) / window.TILE_SIZE);
            const y = Math.floor((e.clientY - rect.top - offsetY) / window.TILE_SIZE);

            if (x >= 0 && x < MAP_WIDTH_TILES && y >= 0 && y < MAP_HEIGHT_TILES) {
                // Skip if clicking on same resource type
                if (this.selectedTool.type === 'resource' && this.isSameResourceType(x, y, this.selectedTool.tileType)) {
                    return; // Skip - let double-click handle it
                }
                // Skip if clicking on NPC (unless delete tool) to allow double-click config
                if (this.selectedTool.type !== 'delete' && this.getNPCAt(x, y)) {
                    return; // Skip - let double-click handle it
                }
                // Skip if clicking on existing image tile (unless delete tool) to allow double-click config
                if (this.selectedTool.type !== 'delete' && imageTilesSystem.hasTile(x, y)) {
                    return; // Skip - let double-click handle it
                }
            }

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
            // If no tool selected, let the click pass through for player movement
            if (!this.selectedTool) return;
            e.stopPropagation();
            e.preventDefault();

            // Check if clicking on an item of the same type as selected tool
            const rect = this.svg.getBoundingClientRect();
            const offsetX = window.MAP_OFFSET_X || 0;
            const offsetY = window.MAP_OFFSET_Y || 0;
            const x = Math.floor((e.clientX - rect.left - offsetX) / window.TILE_SIZE);
            const y = Math.floor((e.clientY - rect.top - offsetY) / window.TILE_SIZE);

            if (x >= 0 && x < MAP_WIDTH_TILES && y >= 0 && y < MAP_HEIGHT_TILES) {
                // If clicking on the same type as selected tool, ignore (let double-click handle it)
                if (this.selectedTool.type === 'resource' && this.isSameResourceType(x, y, this.selectedTool.tileType)) {
                    return;
                }
                // Skip if clicking on NPC (unless delete tool) to allow double-click config
                if (this.selectedTool.type !== 'delete' && this.getNPCAt(x, y)) {
                    return;
                }
                // Skip if clicking on existing image tile (unless delete tool) to allow double-click config
                if (this.selectedTool.type !== 'delete' && imageTilesSystem.hasTile(x, y)) {
                    return;
                }
                this.handleMapInteraction(e);
            }
        };

        this.mapDblClickHandler = (e) => {
            e.stopPropagation();
            console.log('Double-click detected in map editor');

            const rect = this.svg.getBoundingClientRect();
            const offsetX = window.MAP_OFFSET_X || 0;
            const offsetY = window.MAP_OFFSET_Y || 0;

            const x = Math.floor((e.clientX - rect.left - offsetX) / window.TILE_SIZE);
            const y = Math.floor((e.clientY - rect.top - offsetY) / window.TILE_SIZE);

            console.log(`Double-click at tile (${x}, ${y})`);

            if (x >= 0 && x < MAP_WIDTH_TILES && y >= 0 && y < MAP_HEIGHT_TILES) {
                const npcAt = this.getNPCAt(x, y);
                console.log('NPC at position:', npcAt);
                console.log('isConfigurableItem:', this.isConfigurableItem(x, y));

                if (this.isConfigurableItem(x, y)) {
                    this.configureItem(x, y);
                }
            }
        };

        // Add all event listeners
        this.svg.addEventListener('mousedown', this.handleMouseDown);
        this.svg.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
        this.svg.addEventListener('click', this.mapClickHandler);
        this.svg.addEventListener('dblclick', this.mapDblClickHandler);
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
        if (this.mapDblClickHandler) {
            this.svg.removeEventListener('dblclick', this.mapDblClickHandler);
            this.mapDblClickHandler = null;
        }
        // Reset drag state
        this.isDragging = false;
        this.lastTileX = null;
        this.lastTileY = null;
    }

    applyTool(x, y) {
        // If no tool selected, do nothing (double-click handles configuration)
        if (!this.selectedTool) {
            return;
        }

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
            this.scheduleAutoSave();
            return;
        } else if (this.selectedTool.type === 'chicken') {
            this.placeChicken(x, y);
            // Redraw the entire map to ensure chickens are properly displayed
            window.drawMap();
            this.scheduleAutoSave();
            return;
        } else if (this.selectedTool.type === 'cockerel') {
            this.placeCockerel(x, y);
            // Redraw the entire map to ensure cockerels are properly displayed
            window.drawMap();
            this.scheduleAutoSave();
            return;
        } else if (this.selectedTool.type === 'image') {
            this.placeImageTile(x, y);
            window.drawMap();
            this.scheduleAutoSave();
            return;
        }

        // Update only the specific tile instead of redrawing the entire map
        this.updateTileDisplay(x, y);
        this.scheduleAutoSave();
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

        // Remove any collectable data at this position
        collectablesSystem.removeCollectable(x, y);

        // Remove image tile data if present
        if (imageTilesSystem.hasTile(x, y)) {
            imageTilesSystem.removeTile(x, y);
            needsRedraw = true;
        }

        // Check if this is a structure tile
        const isStructureTile = tiles.some(tile => tile.color === 'white' && !tile.passable);

        if (isStructureTile) {
            // Find and remove the entire structure
            this.removeStructureAt(x, y);
        } else if (tiles.length > 1) {
            // Remove the top layer (resource or tile)
            tiles.pop();
        }

        // Check if there's an NPC at this position (use broad detection)
        const npcToDelete = this.getNPCAt(x, y);
        if (npcToDelete) {
            const npcIndex = window.npcs.indexOf(npcToDelete);
            if (npcIndex >= 0) {
                if (npcToDelete.element && npcToDelete.element.parentNode) {
                    npcToDelete.element.parentNode.removeChild(npcToDelete.element);
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

        // Show tip for first collectable placement
        const collectableTypes = [tileTypes.EGG, tileTypes.BADGE];
        if (collectableTypes.includes(resourceType)) {
            this.showCollectableTipOnce();
        }
    }

    showCollectableTipOnce() {
        this.showEditTipOnce('collectable', 'Double-click on a collectable item to add a message that displays when someone collects it!');
    }

    showNPCTipOnce() {
        this.showEditTipOnce('npc', 'Double-click on an NPC to change their name and what they say!');
    }

    showEditTipOnce(type, message) {
        // Only show once per type
        const storageKey = `${type}TipShown`;
        if (localStorage.getItem(storageKey)) {
            return;
        }
        localStorage.setItem(storageKey, 'true');

        // Create tip element
        const tip = document.createElement('div');
        tip.id = 'collectable-tip';
        tip.innerHTML = `
            <div class="collectable-tip-content">
                <span class="collectable-tip-icon">💡</span>
                <span class="collectable-tip-text">
                    <strong>Tip:</strong> ${message}
                </span>
            </div>
            <button class="collectable-tip-close">&times;</button>
        `;

        const style = document.createElement('style');
        style.id = 'collectable-tip-style';
        style.textContent = `
            #collectable-tip {
                position: fixed;
                bottom: 80px;
                right: 20px;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border: 2px solid #4CAF50;
                border-radius: 12px;
                padding: 12px 16px;
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 10000;
                font-family: "Jersey 10", system-ui, sans-serif;
                color: #e0e0e0;
                max-width: 320px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
                animation: tipSlideIn 0.3s ease-out;
            }
            @keyframes tipSlideIn {
                from {
                    opacity: 0;
                    transform: translateX(20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            @keyframes tipFadeOut {
                from {
                    opacity: 1;
                    transform: translateX(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(20px);
                }
            }
            .collectable-tip-content {
                display: flex;
                align-items: flex-start;
                gap: 10px;
            }
            .collectable-tip-icon {
                font-size: 1.5rem;
                flex-shrink: 0;
            }
            .collectable-tip-text {
                font-size: 0.95rem;
                line-height: 1.4;
            }
            .collectable-tip-text strong {
                color: #4CAF50;
            }
            .collectable-tip-close {
                background: none;
                border: none;
                color: #888;
                font-size: 1.5rem;
                cursor: pointer;
                padding: 0;
                line-height: 1;
                flex-shrink: 0;
            }
            .collectable-tip-close:hover {
                color: #fff;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(tip);

        // Close button handler
        const closeTip = () => {
            tip.style.animation = 'tipFadeOut 0.3s ease-in forwards';
            setTimeout(() => {
                tip.remove();
                style.remove();
            }, 300);
        };

        tip.querySelector('.collectable-tip-close').addEventListener('click', closeTip);

        // Auto-fade after 10 seconds
        setTimeout(closeTip, 10000);
    }

    isSameResourceType(x, y, resourceType) {
        // Check if the tile has the same resource type as specified
        const tiles = map[y][x];
        if (!tiles || tiles.length === 0) return false;

        const topTile = tiles[tiles.length - 1];
        return topTile === resourceType;
    }

    getNPCAt(x, y) {
        // Check if there's an NPC at this position (use same logic as NPC.isClicked)
        if (!window.npcs) return null;
        return window.npcs.find(npc => {
            const dx = Math.abs(npc.x - x);
            const dy = Math.abs(npc.y - y);
            return dx <= 1 && dy <= 1;
        });
    }

    isConfigurableItem(x, y) {
        // Check if there's an NPC at this position
        if (this.getNPCAt(x, y)) {
            return true;
        }

        // Check if there's an image tile at this position
        if (imageTilesSystem.hasTile(x, y)) {
            return true;
        }

        // Check if there's a collectable resource at this position
        const tiles = map[y][x];
        if (!tiles || tiles.length === 0) return false;

        const topTile = tiles[tiles.length - 1];

        // Check if it's a configurable resource
        const configurableTypes = [
            tileTypes.LARGE_TREE, tileTypes.BUSH, tileTypes.PINE_TREE,
            tileTypes.ROCK, tileTypes.FLOWER, tileTypes.EGG, tileTypes.BADGE
        ];

        return configurableTypes.some(type => topTile === type);
    }

    configureItem(x, y) {
        if (!this.isConfigurableItem(x, y)) {
            return;
        }

        // Check if it's an NPC
        const npc = this.getNPCAt(x, y);
        if (npc) {
            this.showNPCConfigureDialog(npc);
            return;
        }

        // Check if it's an image tile
        if (imageTilesSystem.hasTile(x, y)) {
            this.showImageUploadDialog(x, y);
            return;
        }

        // Get current collectable data
        const current = collectablesSystem.getCollectable(x, y);
        const currentText = current ? current.text : '';

        this.showConfigureDialog(x, y, currentText);
    }

    showConfigureDialog(x, y, currentText) {
        // Remove existing dialog if present
        const existing = document.getElementById('configure-item-dialog');
        if (existing) existing.remove();

        const dialog = document.createElement('div');
        dialog.id = 'configure-item-dialog';
        dialog.innerHTML = `
            <div class="cloud-save-panel configure-item-panel">
                <h3>Configure Item</h3>
                <p style="color: #888; font-size: 0.9rem; margin-bottom: 12px;">
                    Add text that appears when this item is collected.
                    Leave blank to make it a regular item with no message.
                </p>
                <textarea id="configure-item-text" rows="4" placeholder="Enter collection message...">${currentText}</textarea>
                <div class="cloud-save-actions">
                    <button id="configure-item-confirm" class="auth-btn auth-btn-primary">Save</button>
                    <button id="configure-item-cancel" class="auth-btn auth-btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        // Style the textarea
        const textarea = document.getElementById('configure-item-text');
        textarea.style.cssText = `
            width: 100%;
            padding: 10px;
            border: 2px solid #444;
            border-radius: 6px;
            background: #111;
            color: #eee;
            font-family: inherit;
            font-size: 1rem;
            resize: vertical;
            margin-bottom: 12px;
        `;

        document.getElementById('configure-item-cancel').addEventListener('click', () => {
            dialog.remove();
        });

        document.getElementById('configure-item-confirm').addEventListener('click', () => {
            const newText = document.getElementById('configure-item-text').value.trim();
            collectablesSystem.setCollectable(x, y, newText);
            dialog.remove();
            this.scheduleAutoSave();

            // Show confirmation
            if (newText) {
                this.showSaveIndicator('Item configured');
            } else {
                this.showSaveIndicator('Message removed');
            }
            setTimeout(() => this.hideSaveIndicator(), 1500);
        });

        // Close on click outside
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    showNPCConfigureDialog(npc) {
        // Remove existing dialog if present
        const existing = document.getElementById('configure-npc-dialog');
        if (existing) existing.remove();

        const dialog = document.createElement('div');
        dialog.id = 'configure-npc-dialog';
        dialog.innerHTML = `
            <div class="cloud-save-panel configure-item-panel">
                <h3>Configure NPC</h3>
                <p style="color: #888; font-size: 0.9rem; margin-bottom: 12px;">
                    Set the name and message for this character.
                </p>
                <label style="color: #aaa; font-size: 0.85rem; display: block; margin-bottom: 4px;">Name</label>
                <input type="text" id="configure-npc-name" value="${npc.name || ''}" placeholder="Character name" />
                <label style="color: #aaa; font-size: 0.85rem; display: block; margin-bottom: 4px; margin-top: 12px;">Message</label>
                <textarea id="configure-npc-message" rows="4" placeholder="What does this character say?">${npc.message || ''}</textarea>
                <div class="cloud-save-actions">
                    <button id="configure-npc-confirm" class="auth-btn auth-btn-primary">Save</button>
                    <button id="configure-npc-cancel" class="auth-btn auth-btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        // Style the inputs
        const nameInput = document.getElementById('configure-npc-name');
        nameInput.style.cssText = `
            width: 100%;
            padding: 10px;
            border: 2px solid #444;
            border-radius: 6px;
            background: #111;
            color: #eee;
            font-family: inherit;
            font-size: 1rem;
            margin-bottom: 8px;
        `;

        const textarea = document.getElementById('configure-npc-message');
        textarea.style.cssText = `
            width: 100%;
            padding: 10px;
            border: 2px solid #444;
            border-radius: 6px;
            background: #111;
            color: #eee;
            font-family: inherit;
            font-size: 1rem;
            resize: vertical;
            margin-bottom: 12px;
        `;

        document.getElementById('configure-npc-cancel').addEventListener('click', () => {
            dialog.remove();
        });

        document.getElementById('configure-npc-confirm').addEventListener('click', () => {
            const newName = document.getElementById('configure-npc-name').value.trim();
            const newMessage = document.getElementById('configure-npc-message').value.trim();

            npc.name = newName || 'NPC';
            npc.message = newMessage || '';

            dialog.remove();
            this.scheduleAutoSave();

            this.showSaveIndicator('NPC updated');
            setTimeout(() => this.hideSaveIndicator(), 1500);
        });

        // Close on click outside
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    showImageUploadDialog(x, y) {
        // Remove existing dialog if present
        const existing = document.getElementById('image-upload-dialog');
        if (existing) existing.remove();

        const group = imageTilesSystem.getGroup(x, y);
        const hasImage = group && group.imageData;

        const dialog = document.createElement('div');
        dialog.id = 'image-upload-dialog';
        dialog.innerHTML = `
            <div class="cloud-save-panel image-upload-panel">
                <h3>Image Block</h3>
                <p style="color: #888; font-size: 0.9rem; margin-bottom: 12px;">
                    Upload an image to display across this image block.
                    The image will be stretched to fit the tile area.
                </p>
                <div id="image-upload-preview" class="image-upload-preview">
                    ${hasImage ? `<img src="${group.imageData}" alt="Current image" />` : '<span>No image set</span>'}
                </div>
                <input type="file" id="image-upload-input" accept="image/*" style="display: none;" />
                <div class="cloud-save-actions" style="flex-direction: column; gap: 8px;">
                    <button id="image-upload-choose" class="auth-btn auth-btn-primary">Choose Image</button>
                    ${hasImage ? '<button id="image-upload-remove" class="auth-btn auth-btn-secondary" style="color: #f44336;">Remove Image</button>' : ''}
                    <button id="image-upload-cancel" class="auth-btn auth-btn-secondary">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        const fileInput = document.getElementById('image-upload-input');
        const preview = document.getElementById('image-upload-preview');

        document.getElementById('image-upload-choose').addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Limit file size to 500KB to keep map_data reasonable
            if (file.size > 512000) {
                // Resize the image
                this._resizeImage(file, 500, 500, (dataUrl) => {
                    imageTilesSystem.setGroupImage(x, y, dataUrl);
                    preview.innerHTML = `<img src="${dataUrl}" alt="Uploaded image" />`;
                    this._addRemoveButton(dialog, x, y, preview);
                    window.drawMap();
                    this.scheduleAutoSave();
                });
            } else {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const dataUrl = ev.target.result;
                    imageTilesSystem.setGroupImage(x, y, dataUrl);
                    preview.innerHTML = `<img src="${dataUrl}" alt="Uploaded image" />`;
                    this._addRemoveButton(dialog, x, y, preview);
                    window.drawMap();
                    this.scheduleAutoSave();
                };
                reader.readAsDataURL(file);
            }
        });

        const removeBtn = document.getElementById('image-upload-remove');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                imageTilesSystem.setGroupImage(x, y, null);
                preview.innerHTML = '<span>No image set</span>';
                removeBtn.remove();
                window.drawMap();
                this.scheduleAutoSave();
            });
        }

        document.getElementById('image-upload-cancel').addEventListener('click', () => {
            dialog.remove();
        });

        // Close on click outside
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    _addRemoveButton(dialog, x, y, preview) {
        // Add remove button if not already present
        if (!document.getElementById('image-upload-remove')) {
            const actions = dialog.querySelector('.cloud-save-actions');
            const cancelBtn = document.getElementById('image-upload-cancel');
            const removeBtn = document.createElement('button');
            removeBtn.id = 'image-upload-remove';
            removeBtn.className = 'auth-btn auth-btn-secondary';
            removeBtn.style.color = '#f44336';
            removeBtn.textContent = 'Remove Image';
            actions.insertBefore(removeBtn, cancelBtn);
            removeBtn.addEventListener('click', () => {
                imageTilesSystem.setGroupImage(x, y, null);
                preview.innerHTML = '<span>No image set</span>';
                removeBtn.remove();
                window.drawMap();
                this.scheduleAutoSave();
            });
        }
    }

    _resizeImage(file, maxWidth, maxHeight, callback) {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            let { width, height } = img;
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            URL.revokeObjectURL(url);
            callback(dataUrl);
        };
        img.src = url;
    }

    // Debounced auto-save to Supabase
    scheduleAutoSave() {
        if (!isConfigured() || !getCurrentUser() || !window.currentMapId) {
            return;
        }

        // Clear existing timeout
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        // Schedule save after 2 seconds of no changes
        this.autoSaveTimeout = setTimeout(() => {
            this.autoSave();
        }, 2000);
    }

    async autoSave() {
        if (this.isSaving || !window.currentMapId) {
            return;
        }

        this.isSaving = true;
        this.showSaveIndicator('Saving...');

        try {
            const mapData = this.convertMapToJSON();
            await saveMapToSupabase(
                mapData,
                'My World',
                '',
                true,
                window.currentMapId
            );
            this.showSaveIndicator('Saved');
            setTimeout(() => this.hideSaveIndicator(), 1500);
        } catch (err) {
            console.error('Auto-save failed:', err);
            this.showSaveIndicator('Save failed');
            setTimeout(() => this.hideSaveIndicator(), 3000);
        } finally {
            this.isSaving = false;
        }
    }

    showSaveIndicator(text) {
        let indicator = document.getElementById('autosave-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'autosave-indicator';
            indicator.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: #4caf50;
                padding: 8px 16px;
                border-radius: 4px;
                font-family: "Jersey 10", system-ui, sans-serif;
                font-size: 14px;
                z-index: 9999;
            `;
            document.body.appendChild(indicator);
        }
        indicator.textContent = text;
        indicator.style.display = 'block';
    }

    hideSaveIndicator() {
        const indicator = document.getElementById('autosave-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
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

        // Show tip about double-click to edit
        this.showNPCTipOnce();

        console.log(`NPC ${tool.npcType} placed at (${x}, ${y}). Total NPCs: ${window.npcs.length}`);
    }

    placeChicken(x, y) {
        // Check population limit
        if (!canPlaceHen()) {
            this.showSaveIndicator('Hen limit reached');
            setTimeout(() => this.hideSaveIndicator(), 2000);
            return;
        }

        // Check if the tile is passable
        const tiles = map[y][x];
        const topTile = tiles[tiles.length - 1];
        if (!topTile.passable) {
            return;
        }

        // Check if there's already a chicken at this position
        if (window.chickens && window.chickens.find(chicken => chicken.x === x && chicken.y === y)) {
            return;
        }

        // Create chicken at the specified position
        const chicken = new Chicken(this.svg, x, y);

        // Add to global chickens array
        if (!window.chickens) window.chickens = [];
        window.chickens.push(chicken);
    }

    placeCockerel(x, y) {
        // Check population limit
        if (!canPlaceRooster()) {
            this.showSaveIndicator('Rooster limit reached');
            setTimeout(() => this.hideSaveIndicator(), 2000);
            return;
        }

        // Check if the tile is passable
        const tiles = map[y][x];
        const topTile = tiles[tiles.length - 1];
        if (!topTile.passable) {
            return;
        }

        // Check if there's already a cockerel at this position
        if (window.cockerels && window.cockerels.find(cockerel => cockerel.x === x && cockerel.y === y)) {
            return;
        }

        // Create cockerel at the specified position
        const cockerel = new Cockerel(this.svg, x, y);

        // Add to global cockerels array
        if (!window.cockerels) window.cockerels = [];
        window.cockerels.push(cockerel);
    }

    placeImageTile(x, y) {
        const tiles = map[y][x];
        const topTile = tiles[tiles.length - 1];

        // Don't place on structures
        if (topTile.color === 'white' && !topTile.passable) return;

        // Don't place if already an image tile here
        if (imageTilesSystem.hasTile(x, y)) return;

        // Set the tile layer to IMAGE type (on top of base)
        if (tiles.length > 1) {
            // Remove existing resource overlay if any
            const top = tiles[tiles.length - 1];
            if (top.resource) tiles.pop();
        }
        tiles.push(tileTypes.IMAGE);

        // Register in image tile system
        imageTilesSystem.addTile(x, y);

        // Show tip once
        this.showEditTipOnce('image', 'Double-click on an image block to upload an image! Place tiles next to each other to make a larger image area.');
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
                    case 'IMAGE': return tileTypes.IMAGE;
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
                        if (layer === tileTypes.IMAGE) return 'IMAGE';
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

        // Add cockerels
        const cockerels = [];
        if (window.cockerels) {
            window.cockerels.forEach(cockerel => {
                cockerels.push({
                    x: cockerel.x,
                    y: cockerel.y
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
            chickens,
            cockerels,
            introText: window.currentMapIntroText || null,
            pageTitle: window.currentMapPageTitle || null,
            collectables: collectablesSystem.toMapData(),
            imageTiles: imageTilesSystem.toMapData()
        };
    }

    showIntroTextDialog() {
        // Remove existing dialog if present
        const existing = document.getElementById('intro-text-dialog');
        if (existing) existing.remove();

        const currentText = window.currentMapIntroText || '';

        const dialog = document.createElement('div');
        dialog.id = 'intro-text-dialog';
        dialog.innerHTML = `
            <div class="cloud-save-panel intro-text-panel">
                <h3>Welcome Message</h3>
                <p style="color: #888; font-size: 0.9rem; margin-bottom: 12px;">
                    This message is shown to visitors when they first arrive at your world.
                    Leave blank to use the default message.
                </p>
                <textarea id="intro-text-input" rows="6" placeholder="Enter your welcome message...">${currentText}</textarea>
                <div class="cloud-save-actions">
                    <button id="intro-text-confirm" class="auth-btn auth-btn-primary">Save</button>
                    <button id="intro-text-cancel" class="auth-btn auth-btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        // Add styles for the textarea
        const textarea = document.getElementById('intro-text-input');
        textarea.style.cssText = `
            width: 100%;
            padding: 10px;
            border: 1px solid #333;
            border-radius: 6px;
            background: #1a1a2e;
            color: #e0e0e0;
            font-family: inherit;
            font-size: 1rem;
            resize: vertical;
            margin-bottom: 12px;
        `;

        document.getElementById('intro-text-cancel').addEventListener('click', () => {
            dialog.remove();
        });

        document.getElementById('intro-text-confirm').addEventListener('click', () => {
            const newText = document.getElementById('intro-text-input').value.trim();
            window.currentMapIntroText = newText || null;
            dialog.remove();

            // Trigger auto-save if configured
            this.scheduleAutoSave();
        });

        // Close on click outside
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    showPageTitleDialog() {
        // Remove existing dialog if present
        const existing = document.getElementById('page-title-dialog');
        if (existing) existing.remove();

        const currentTitle = window.currentMapPageTitle || '';

        const dialog = document.createElement('div');
        dialog.id = 'page-title-dialog';
        dialog.innerHTML = `
            <div class="cloud-save-panel page-title-panel">
                <h3>Page Title</h3>
                <p style="color: #888; font-size: 0.9rem; margin-bottom: 12px;">
                    This is the title shown in the browser tab when visitors view your world.
                </p>
                <input type="text" id="page-title-input" placeholder="My World" value="${currentTitle}" />
                <div class="cloud-save-actions">
                    <button id="page-title-confirm" class="auth-btn auth-btn-primary">Save</button>
                    <button id="page-title-cancel" class="auth-btn auth-btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        document.getElementById('page-title-cancel').addEventListener('click', () => {
            dialog.remove();
        });

        document.getElementById('page-title-confirm').addEventListener('click', () => {
            const newTitle = document.getElementById('page-title-input').value.trim();
            window.currentMapPageTitle = newTitle || null;

            // Update the current page title
            if (newTitle) {
                document.title = `${newTitle} - maap.to`;
            }

            dialog.remove();
            this.scheduleAutoSave();
        });

        // Close on click outside
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    showUpgradePrompt(featureName) {
        const existing = document.getElementById('upgrade-prompt-dialog');
        if (existing) existing.remove();

        const dialog = document.createElement('div');
        dialog.id = 'upgrade-prompt-dialog';
        dialog.innerHTML = `
            <div class="cloud-save-panel upgrade-prompt-panel">
                <h3>Paid Feature</h3>
                <p style="color: #888; font-size: 0.9rem; margin-bottom: 12px;">
                    <strong>${featureName}</strong> is available on the paid plan.
                    Upgrade to unlock NPCs, structures, and larger maps.
                </p>
                <div class="cloud-save-actions">
                    <button id="upgrade-prompt-subscribe" class="auth-btn auth-btn-primary">Subscribe</button>
                    <button id="upgrade-prompt-close" class="auth-btn auth-btn-secondary">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        document.getElementById('upgrade-prompt-close').addEventListener('click', () => {
            dialog.remove();
        });

        document.getElementById('upgrade-prompt-subscribe').addEventListener('click', async () => {
            const btn = document.getElementById('upgrade-prompt-subscribe');
            btn.disabled = true;
            btn.textContent = 'Redirecting...';

            try {
                const user = getCurrentUser();
                const username = user?.user_metadata?.username || window.currentMapProfile?.username;

                if (!user || !username) {
                    throw new Error('Unable to get user info');
                }

                // Get auth token for Supabase edge function
                const sb = getSupabase();
                const { data: { session } } = await sb.auth.getSession();
                const accessToken = session?.access_token;

                const response = await fetch('/api/create-checkout-session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': config.SUPABASE_ANON_KEY,
                        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
                    },
                    body: JSON.stringify({
                        priceId: config.STRIPE_PRICE_EARLY_BIRD,
                        userId: user.id,
                        username: username,
                        successUrl: `${window.location.origin}/${username}?welcome=1`,
                        cancelUrl: `${window.location.origin}/${username}?canceled=1`
                    })
                });

                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }

                const data = await response.json();
                if (data.error) throw new Error(data.error);
                if (!data.sessionId) throw new Error('No sessionId returned');

                const stripe = Stripe(config.STRIPE_PUBLISHABLE_KEY);
                const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
                if (error) throw error;

            } catch (err) {
                console.error('Checkout error:', err);
                btn.disabled = false;
                btn.textContent = 'Subscribe';
                alert('Failed to start checkout: ' + err.message);
            }
        });

        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

    resizeMap(newWidth, newHeight) {
        const oldWidth = MAP_WIDTH_TILES;
        const oldHeight = MAP_HEIGHT_TILES;

        if (newWidth === oldWidth && newHeight === oldHeight) return;

        // Calculate centering offsets
        const offsetX = Math.floor((newWidth - oldWidth) / 2);
        const offsetY = Math.floor((newHeight - oldHeight) / 2);

        // Create new map filled with water
        const newMap = Array(newHeight).fill(null).map(() =>
            Array(newWidth).fill(null).map(() => [tileTypes.WATER])
        );

        // Copy old map data to new positions
        for (let y = 0; y < oldHeight; y++) {
            for (let x = 0; x < oldWidth; x++) {
                const newX = x + offsetX;
                const newY = y + offsetY;
                if (newX >= 0 && newX < newWidth && newY >= 0 && newY < newHeight) {
                    newMap[newY][newX] = map[y][x];
                }
            }
        }

        // Update the map
        replaceMap(newMap, newWidth, newHeight);

        // Shift structure positions
        if (window.farmhouse) {
            window.farmhouse.x += offsetX;
            window.farmhouse.y += offsetY;
        }
        if (window.chickenCoop) {
            window.chickenCoop.x += offsetX;
            window.chickenCoop.y += offsetY;
        }
        if (window.signObj) {
            window.signObj.x += offsetX;
            window.signObj.y += offsetY;
        }

        // Shift NPC positions
        if (window.npcs) {
            window.npcs.forEach(npc => {
                npc.x += offsetX;
                npc.y += offsetY;
            });
        }

        // Shift chicken positions
        if (window.chickens) {
            window.chickens.forEach(chicken => {
                chicken.x += offsetX;
                chicken.y += offsetY;
            });
        }

        // Shift cockerel positions
        if (window.cockerels) {
            window.cockerels.forEach(cockerel => {
                cockerel.x += offsetX;
                cockerel.y += offsetY;
            });
        }

        // Shift player position
        if (window.player) {
            window.player.x += offsetX;
            window.player.y += offsetY;
        }

        // Shift collectable positions
        collectablesSystem.shiftPositions(offsetX, offsetY);

        // Recalculate tile size and redraw
        if (window.updateTileSize) window.updateTileSize();
        window.drawMap();

        // Update entity positions visually
        if (window.player) window.player.updatePosition();
        if (window.npcs) window.npcs.forEach(npc => npc.updatePosition());
        if (window.chickens) window.chickens.forEach(c => c.updatePosition());
        if (window.cockerels) window.cockerels.forEach(c => c.updatePosition());

        // Update viewport for mobile
        if (window.updateViewport) window.updateViewport();

        // Auto-save the resized map
        this.scheduleAutoSave();

        this.showSaveIndicator(`Resized to ${newWidth}x${newHeight}`);
        setTimeout(() => this.hideSaveIndicator(), 2000);
    }
}