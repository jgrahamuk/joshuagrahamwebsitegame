import { tileTypes, placeResourceAtPosition, removeResource, map, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, replaceMap, getTileSprite, getTileRotations, setTileRotation, setTileRotations, pushTileRotation, popTileRotation, clearTileRotation, clearAllTileRotations, isRotatable, isStackable, rotateTile, redrawTileOnCanvas } from './map.js';
import { getSpriteUrl } from './spriteCache.js';
import { NPC } from './npcs.js';
import { Chicken, Cockerel, canPlaceHen, canPlaceRooster } from './chickens.js';
import { saveMapToSupabase } from './mapBrowser.js';
import { getCurrentUser } from './auth.js';
import { isConfigured, getSupabase } from './supabase.js';
import { collectablesSystem } from './collectables.js';
import { imageTilesSystem } from './imageTiles.js';
import { textTilesSystem } from './textTiles.js';
import { getUserTier, isPaidTool, TIERS } from './tiers.js';
import { config } from './config.js';

const WEB_SAFE_FONTS = [
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Arial Black', value: '"Arial Black", sans-serif' },
    { label: 'Book Antiqua', value: '"Book Antiqua", serif' },
    { label: 'Brush Script MT', value: '"Brush Script MT", cursive' },
    { label: 'Comic Sans MS', value: '"Comic Sans MS", cursive' },
    { label: 'Courier New', value: '"Courier New", monospace' },
    { label: 'Garamond', value: 'Garamond, serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Helvetica', value: 'Helvetica, sans-serif' },
    { label: 'Impact', value: 'Impact, sans-serif' },
    { label: 'Lucida Console', value: '"Lucida Console", monospace' },
    { label: 'Lucida Sans Unicode', value: '"Lucida Sans Unicode", sans-serif' },
    { label: 'Palatino Linotype', value: '"Palatino Linotype", serif' },
    { label: 'Tahoma', value: 'Tahoma, sans-serif' },
    { label: 'Times New Roman', value: '"Times New Roman", serif' },
    { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'sans-serif', value: 'sans-serif' },
    { label: 'serif', value: 'serif' },
    { label: 'monospace', value: 'monospace' },
    { label: 'cursive', value: 'cursive' },
    { label: 'fantasy', value: 'fantasy' },
];

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
        this.inlineTextEditor = null;
        this._inlineTextClickOutsideHandler = null;

        this.tools = [
            { id: 'delete', name: 'Delete', icon: '🗑️', type: 'delete' },
            { id: 'grass', name: 'Grass', icon: 'tile-grass.gif', type: 'tile', tileType: tileTypes.GRASS },
            { id: 'dirt', name: 'Dirt', icon: 'tile-dirt.gif', type: 'tile', tileType: tileTypes.DIRT },
            { id: 'water', name: 'Water', icon: 'tile-water.gif', type: 'tile', tileType: tileTypes.WATER },
            { id: 'bridge_h', name: 'Bridge (H)', icon: 'bridge-horizontal.gif', type: 'tile', tileType: tileTypes.BRIDGE_H },
            { id: 'bridge_v', name: 'Bridge (V)', icon: 'bridge-vertical.gif', type: 'tile', tileType: tileTypes.BRIDGE_V },
            { id: 'grass_edge', name: 'Grass Edge', icon: 'tile-grass-edge.gif', type: 'tile', tileType: tileTypes.GRASS_EDGE },
            { id: 'grass_corner', name: 'Grass Corner', icon: 'tile-grass-corner.gif', type: 'tile', tileType: tileTypes.GRASS_CORNER },
            { id: 'grass_corner_inside', name: 'Inside Corner', icon: 'tile-grass-corner-inside.gif', type: 'tile', tileType: tileTypes.GRASS_CORNER_INSIDE },
            { id: 'large_tree', name: 'Large Tree', icon: 'tree.gif', type: 'resource', tileType: tileTypes.LARGE_TREE },
            { id: 'bush', name: 'Bush', icon: 'bush.gif', type: 'resource', tileType: tileTypes.BUSH },
            { id: 'pine_tree', name: 'Pine Tree', icon: 'pine-tree.gif', type: 'resource', tileType: tileTypes.PINE_TREE },
            { id: 'rock', name: 'Rock', icon: 'stone.gif', type: 'resource', tileType: tileTypes.ROCK },
            { id: 'flower', name: 'Flower', icon: 'flower.gif', type: 'resource', tileType: tileTypes.FLOWER },
            { id: 'flower_rose', name: 'Rose', icon: 'flower-rose.gif', type: 'resource', tileType: tileTypes.FLOWER_ROSE },
            { id: 'flower_forgetmenot', name: 'Forget-me-not', icon: 'flower-forgetmenot.gif', type: 'resource', tileType: tileTypes.FLOWER_FORGETMENOT },
            { id: 'flower_tulip', name: 'Tulip', icon: 'flower-tulip.gif', type: 'resource', tileType: tileTypes.FLOWER_TULIP },
            { id: 'flower_bluebell', name: 'Bluebell', icon: 'flower-bluebell.gif', type: 'resource', tileType: tileTypes.FLOWER_BLUEBELL },
            { id: 'egg', name: 'Egg', icon: 'egg.gif', type: 'resource', tileType: tileTypes.EGG },
            { id: 'badge', name: 'Badge', icon: 'badge.gif', type: 'resource', tileType: tileTypes.BADGE },
            // Structures
            { id: 'farmhouse', name: 'Farmhouse', icon: 'farmhouse.gif', type: 'structure', structureType: 'FARMHOUSE', width: 10, height: 6 },
            { id: 'chicken_coop', name: 'Chicken Coop', icon: 'chicken-coop.gif', type: 'structure', structureType: 'CHICKEN_COOP', width: 5, height: 3 },
            { id: 'portal', name: 'Portal', icon: 'portal-purple.gif', type: 'structure', structureType: 'PORTAL', width: 3, height: 3 },
            // NPCs
            { id: 'npc_joshua', name: 'Joshua NPC', icon: 'joshua-front.gif', type: 'npc', npcType: 'Joshua', message: 'Welcome to my farm! It looks like the chickens are having a great time.' },
            // Chickens and Cockerels
            { id: 'chicken', name: 'Chicken', icon: 'chicken-front.gif', type: 'chicken' },
            { id: 'cockerel', name: 'Cockerel', icon: 'cockerel-front.gif', type: 'cockerel' },
            // Image tile
            { id: 'image', name: 'Image', icon: '🖼️', type: 'image', tileType: tileTypes.IMAGE },
            { id: 'text', name: 'Text', icon: 'T', type: 'text', tileType: tileTypes.TEXT }
        ];

        // Tool groups for the toolbar flyout UI
        this.toolGroups = [
            { id: 'delete', label: 'Delete', toolIds: ['delete'], standalone: true },
            { id: 'terrain', label: 'Terrain', toolIds: ['grass', 'grass_edge', 'grass_corner', 'grass_corner_inside', 'dirt', 'water', 'bridge_h', 'bridge_v'] },
            { id: 'nature', label: 'Nature', toolIds: ['large_tree', 'bush', 'pine_tree', 'rock', 'flower', 'flower_rose', 'flower_forgetmenot', 'flower_tulip', 'flower_bluebell'] },
            { id: 'collectables', label: 'Collectables', toolIds: ['egg', 'badge'] },
            { id: 'buildings', label: 'Buildings', toolIds: ['farmhouse', 'chicken_coop', 'portal'] },
            { id: 'creatures', label: 'Creatures', toolIds: ['chicken', 'cockerel'] },
            { id: 'npcs', label: 'NPCs', toolIds: ['npc_joshua'], standalone: true },
            { id: 'image', label: 'Image', toolIds: ['image'], standalone: true },
            { id: 'text', label: 'Text', toolIds: ['text'], standalone: true },
        ];

        // Track which tool is the "primary" (visible) for each group
        this.groupPrimaries = {};
        this.toolGroups.forEach(g => {
            this.groupPrimaries[g.id] = g.toolIds[0];
        });

        // Currently expanded flyout group id
        this.expandedGroup = null;

        // Help system
        this.toolTips = {
            'delete': 'Click or drag to remove items and resources.',
            'grass': 'Click or drag to place grass tiles.',
            'dirt': 'Click or drag to place dirt paths.',
            'water': 'Click or drag to place water. Impassable for visitors.',
            'bridge_h': 'Click or drag to place a horizontal bridge. Passable.',
            'bridge_v': 'Click or drag to place a vertical bridge. Passable.',
            'grass_edge': 'Place a grass edge tile. Double-click to rotate.',
            'grass_corner': 'Place a grass corner tile. Double-click to rotate.',
            'grass_corner_inside': 'Place an inside corner tile. Double-click to rotate.',
            'large_tree': 'Click to place trees. Double-click any item to configure.',
            'bush': 'Click to place bushes. Double-click to configure.',
            'pine_tree': 'Click to place pine trees. Double-click to configure.',
            'rock': 'Click to place rocks. Double-click to configure.',
            'flower': 'Click to place flowers. Double-click to configure.',
            'flower_rose': 'Click to place roses. Double-click to configure.',
            'flower_forgetmenot': 'Click to place forget-me-nots. Double-click to configure.',
            'flower_tulip': 'Click to place tulips. Double-click to configure.',
            'flower_bluebell': 'Click to place bluebells. Double-click to configure.',
            'egg': 'Place an egg. Chickens also lay eggs that hatch into chicks!',
            'badge': 'Place a collectable badge. Double-click to add a message.',
            'farmhouse': 'Place a farmhouse (10\u00d76). Needs clear space.',
            'chicken_coop': 'Place a chicken coop (5\u00d73). Needs clear space.',
            'portal': 'Place a portal (3\u00d73). Double-click to set a link URL.',
            'npc_joshua': 'Click to place an NPC. Double-click to edit name and dialog.',
            'chicken': 'Place a hen. Hens wander and lay eggs that hatch!',
            'cockerel': 'Place a rooster. Roosters wander and peck.',
            'image': 'Place image tiles next to each other, then double-click to upload.',
            'text': 'Place text tiles next to each other, then double-click to edit.',
        };
        this.tipsCollapsed = localStorage.getItem('editorTipsCollapsed') === 'true';
        this.helpSystemEl = null;
        this.tipBubble = null;
        this.statusEl = null;
        this.statusTimeout = null;
        this.defaultRotation = 0;

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
        this.createHelpSystem();
        this.setupMapClickHandler();

        // Hide inventory UI and player character when editing
        const uiContainer = document.getElementById('ui-container');
        if (uiContainer) {
            uiContainer.style.display = 'none';
        }
        if (window.player && window.player.element) {
            window.player.element.style.display = 'none';
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
        this.destroyHelpSystem();
        this.removeMapClickHandler();

        // Show inventory UI and player character when done editing
        const uiContainer = document.getElementById('ui-container');
        if (uiContainer) {
            uiContainer.style.display = '';
        }
        if (window.player && window.player.element) {
            window.player.element.style.display = '';
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

    cycleDefaultRotation() {
        this.defaultRotation = (this.defaultRotation + 90) % 360;
        // Update all visible buttons for this tool to show the rotation
        if (this.selectedTool) {
            this.toolbarContainer.querySelectorAll(`button[data-tool-id="${this.selectedTool.id}"] img`).forEach(img => {
                img.style.transform = this.defaultRotation ? `rotate(${this.defaultRotation}deg)` : '';
            });
            // Also update the primary button if it's showing this tool
            const group = this.toolGroups.find(g => g.toolIds.includes(this.selectedTool.id));
            if (group && !group.standalone) {
                const wrapper = this.toolbarContainer.querySelector(`.tool-group[data-group-id="${group.id}"]`);
                if (wrapper) {
                    const primaryImg = wrapper.querySelector('.tool-group-primary img');
                    if (primaryImg) {
                        primaryImg.style.transform = this.defaultRotation ? `rotate(${this.defaultRotation}deg)` : '';
                    }
                }
            }
        }
        this.updateToolTip();
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
                primaryBtn.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    if (this.selectedTool && isRotatable(this.selectedTool.tileType)) {
                        this.cycleDefaultRotation();
                    }
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
                    flyBtn.addEventListener('dblclick', (e) => {
                        e.stopPropagation();
                        if (isRotatable(tool.tileType)) {
                            this.cycleDefaultRotation();
                        }
                    });
                    flyout.appendChild(flyBtn);
                });

                wrapper.appendChild(flyout);
                this.toolbarContainer.appendChild(wrapper);
            }
        });

        // Add world settings button
        const settingsButton = document.createElement('button');
        settingsButton.innerHTML = '\u2699\uFE0F';
        settingsButton.title = 'World Settings';
        settingsButton.className = 'export-button settings-button';
        settingsButton.addEventListener('click', () => {
            this.collapseAllFlyouts();
            this.showWorldSettingsDialog();
        });
        this.toolbarContainer.appendChild(settingsButton);

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
            this.defaultRotation = 0;
            this.toolbarContainer.querySelectorAll('button img').forEach(img => {
                img.style.transform = '';
            });
            this.toolbarContainer.querySelectorAll('button.selected').forEach(btn => {
                btn.classList.remove('selected');
            });
            this.updateToolTip();
            return;
        }

        // Reset default rotation when switching tools
        if (!this.selectedTool || this.selectedTool.id !== tool.id) {
            this.defaultRotation = 0;
            // Clear any icon rotation transforms
            this.toolbarContainer.querySelectorAll('button img').forEach(img => {
                img.style.transform = '';
            });
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
        this.updateToolTip();
    }

    setupMapClickHandler() {
        // Create bound event handlers that we can properly remove later
        this.handleMouseDown = (e) => {
            if (this.inlineTextEditor) return;
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
                // Skip if clicking on existing text tile (unless delete tool) to allow double-click config
                if (this.selectedTool.type !== 'delete' && textTilesSystem.hasTile(x, y)) {
                    return; // Skip - let double-click handle it
                }
                // Skip if clicking on a portal (unless delete tool) to allow double-click config
                if (this.selectedTool.type !== 'delete' && this.getPortalAt(x, y)) {
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
            if (this.inlineTextEditor) return;
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
                // Skip if clicking on existing text tile (unless delete tool) to allow double-click config
                if (this.selectedTool.type !== 'delete' && textTilesSystem.hasTile(x, y)) {
                    return;
                }
                // Skip if clicking on a portal (unless delete tool) to allow double-click config
                if (this.selectedTool.type !== 'delete' && this.getPortalAt(x, y)) {
                    return;
                }
                this.handleMapInteraction(e);
            }
        };

        this.mapDblClickHandler = (e) => {
            if (this.inlineTextEditor) return;
            // Cancel any pending teleport viewport shift
            if (window._editorTeleportTimer) {
                clearTimeout(window._editorTeleportTimer);
                window._editorTeleportTimer = null;
            }
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
        const effW = window.effectiveMapWidth || MAP_WIDTH_TILES;
        const effH = window.effectiveMapHeight || MAP_HEIGHT_TILES;

        if (x >= 0 && x < MAP_WIDTH_TILES && y >= 0 && y < MAP_HEIGHT_TILES) {
            // Check if within effective (tier-allowed) bounds
            if (x >= effW || y >= effH) {
                if (this.selectedTool) {
                    this.showSaveIndicator('Upgrade to edit this area');
                    setTimeout(() => this.hideSaveIndicator(), 1500);
                }
                return;
            }
            // Only apply the tool if this is a new tile position
            if (x !== this.lastTileX || y !== this.lastTileY) {
                this.applyTool(x, y);
                this.lastTileX = x;
                this.lastTileY = y;
            }
        } else if (this.selectedTool) {
            this.showSaveIndicator('Outside map area');
            setTimeout(() => this.hideSaveIndicator(), 1500);
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
            window.drawMap();
            this.scheduleAutoSave();
            return;
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
        } else if (this.selectedTool.type === 'text') {
            this.placeTextTile(x, y);
            window.drawMap();
            this.scheduleAutoSave();
            return;
        }

        // Update only the specific tile instead of redrawing the entire map
        this.updateTileDisplay(x, y);
        this.scheduleAutoSave();
    }

    updateTileDisplay(x, y) {
        // Tile position in grid coords (container transform handles panning)
        const tileX = x * window.TILE_SIZE;
        const tileY = y * window.TILE_SIZE;

        // Find the map container for appending new elements
        const container = this.svg.querySelector('#map-container');
        const dynamicGroup = container ? container.querySelector('#dynamic-elements') : null;
        const searchRoot = container || this.svg;

        // Update base terrain + overlays on the offscreen canvas
        redrawTileOnCanvas(x, y);

        // Remove any existing resource SVG at this position
        const existingResources = searchRoot.querySelectorAll('image[data-resource]');
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

        // Redraw the specific tile's resource overlay
        const tiles = map[y][x];

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
        } else if (top === tileTypes.FLOWER_ROSE) {
            overlay = 'flower-rose.gif';
        } else if (top === tileTypes.FLOWER_FORGETMENOT) {
            overlay = 'flower-forgetmenot.gif';
        } else if (top === tileTypes.FLOWER_TULIP) {
            overlay = 'flower-tulip.gif';
        } else if (top === tileTypes.FLOWER_BLUEBELL) {
            overlay = 'flower-bluebell.gif';
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
            imgOverlay.style.zIndex = '2';
            if (container && dynamicGroup) {
                container.insertBefore(imgOverlay, dynamicGroup);
            } else {
                this.svg.appendChild(imgOverlay);
            }
        }
    }

    deleteTile(x, y) {
        const tiles = map[y][x];
        let needsRedraw = false;

        // Remove any collectable data at this position
        collectablesSystem.removeCollectable(x, y);

        // Pop or clear tile rotation data depending on whether top tile is stackable
        const topForRotation = tiles.length > 0 ? tiles[tiles.length - 1] : null;
        if (topForRotation && isStackable(topForRotation)) {
            popTileRotation(x, y);
        } else {
            clearTileRotation(x, y);
        }

        // Remove image tile data if present
        if (imageTilesSystem.hasTile(x, y)) {
            imageTilesSystem.removeTile(x, y);
            needsRedraw = true;
        }

        // Remove text tile data if present
        if (textTilesSystem.hasTile(x, y)) {
            textTilesSystem.removeTile(x, y);
            needsRedraw = true;
        }

        // Check if this is a structure tile
        const isStructureTile = tiles.some(tile => tile.color === 'white' && !tile.passable);

        if (isStructureTile) {
            // Find and remove the entire structure
            this.removeStructureAt(x, y);
            needsRedraw = true;
        } else if (tiles.length > 1) {
            // Remove the top layer (resource or tile)
            tiles.pop();
        } else if (tiles.length === 1 && tiles[0] !== tileTypes.WATER) {
            // Single non-water tile (e.g. original grass) — replace with water
            tiles[0] = tileTypes.WATER;
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

        // Ensure water is always at the base
        if (tiles.length === 1 && tiles[0] !== tileTypes.WATER) {
            tiles[0] = tileTypes.WATER;
        }

        // Placing water just resets to bare water
        if (tileType === tileTypes.WATER) {
            tiles.length = 1;
            tiles[0] = tileTypes.WATER;
            clearTileRotation(x, y);
            return;
        }

        if (isStackable(tileType)) {
            // Stackable tiles get pushed on top
            tiles.push(tileType);
            pushTileRotation(x, y, this.defaultRotation);
        } else if (getTileSprite(tileType)) {
            // Custom-sprite overlay tiles (grass edge/corner): stack on top of base terrain
            // Strip any existing custom-sprite overlays first
            while (tiles.length > 1 && getTileSprite(tiles[tiles.length - 1])) {
                tiles.pop();
            }
            clearTileRotation(x, y);
            tiles.push(tileType);
            if (isRotatable(tileType) && this.defaultRotation) {
                setTileRotation(x, y, this.defaultRotation);
            }
        } else {
            // Base terrain tiles: replace the top non-water layer
            // Strip any existing custom-sprite overlays first
            while (tiles.length > 1 && getTileSprite(tiles[tiles.length - 1])) {
                tiles.pop();
            }
            clearTileRotation(x, y);

            // Replace the top layer if it's not water, otherwise add a new layer
            if (tiles.length > 1 && tiles[tiles.length - 1] !== tileTypes.WATER) {
                tiles[tiles.length - 1] = tileType;
            } else {
                tiles.push(tileType);
            }
        }
    }

    placeResource(x, y, resourceType) {
        // Use the existing function from map.js
        placeResourceAtPosition(x, y, resourceType);
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

    getPortalAt(x, y) {
        if (!window.portals) return null;
        return window.portals.find(p =>
            x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h
        ) || null;
    }

    isConfigurableItem(x, y) {
        // Check if there's a portal at this position
        if (this.getPortalAt(x, y)) {
            return true;
        }

        // Check if there's an NPC at this position
        if (this.getNPCAt(x, y)) {
            return true;
        }

        // Check if there's an image tile at this position
        if (imageTilesSystem.hasTile(x, y)) {
            return true;
        }

        // Check if there's a text tile at this position
        if (textTilesSystem.hasTile(x, y)) {
            return true;
        }

        // Check if there's a collectable resource at this position
        const tiles = map[y][x];
        if (!tiles || tiles.length === 0) return false;

        const topTile = tiles[tiles.length - 1];

        // Check if it's a rotatable tile
        if (isRotatable(topTile)) return true;

        // Check if it's a configurable resource
        const configurableTypes = [
            tileTypes.LARGE_TREE, tileTypes.BUSH, tileTypes.PINE_TREE,
            tileTypes.ROCK, tileTypes.FLOWER, tileTypes.FLOWER_ROSE, tileTypes.FLOWER_FORGETMENOT, tileTypes.FLOWER_TULIP, tileTypes.FLOWER_BLUEBELL, tileTypes.EGG, tileTypes.BADGE
        ];

        return configurableTypes.some(type => topTile === type);
    }

    configureItem(x, y) {
        if (!this.isConfigurableItem(x, y)) {
            return;
        }

        // Check if it's a rotatable tile — rotate it
        const tiles = map[y][x];
        const topTile = tiles[tiles.length - 1];
        if (isRotatable(topTile)) {
            rotateTile(x, y);
            this.updateTileDisplay(x, y);
            this.scheduleAutoSave();
            return;
        }

        // Check if it's a portal
        const portal = this.getPortalAt(x, y);
        if (portal) {
            this.showPortalConfigureDialog(portal);
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

        // Check if it's a text tile
        if (textTilesSystem.hasTile(x, y)) {
            this.showInlineTextEditor(x, y);
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

    showPortalConfigureDialog(portal) {
        // Remove existing dialog if present
        const existing = document.getElementById('configure-portal-dialog');
        if (existing) existing.remove();

        const dialog = document.createElement('div');
        dialog.id = 'configure-portal-dialog';
        dialog.innerHTML = `
            <div class="cloud-save-panel configure-item-panel">
                <h3>Configure Portal</h3>
                <p style="color: #888; font-size: 0.9rem; margin-bottom: 12px;">
                    Set the URL that visitors will be taken to when they walk to this portal.
                </p>
                <label style="color: #aaa; font-size: 0.85rem; display: block; margin-bottom: 4px;">URL</label>
                <input type="text" id="configure-portal-url" value="${portal.url || ''}" placeholder="https://example.com" />
                <div class="cloud-save-actions">
                    <button id="configure-portal-confirm" class="auth-btn auth-btn-primary">Save</button>
                    <button id="configure-portal-cancel" class="auth-btn auth-btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        // Style the input
        const urlInput = document.getElementById('configure-portal-url');
        urlInput.style.cssText = `
            width: 100%;
            padding: 10px;
            border: 2px solid #444;
            border-radius: 6px;
            background: #111;
            color: #eee;
            font-family: inherit;
            font-size: 1rem;
            margin-bottom: 12px;
        `;

        document.getElementById('configure-portal-cancel').addEventListener('click', () => {
            dialog.remove();
        });

        document.getElementById('configure-portal-confirm').addEventListener('click', () => {
            const newUrl = document.getElementById('configure-portal-url').value.trim();
            portal.url = newUrl;
            dialog.remove();
            this.scheduleAutoSave();

            this.showSaveIndicator(newUrl ? 'Portal URL set' : 'Portal URL cleared');
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
        const libraryImages = this._getImageLibrary(x, y);

        const libraryHTML = libraryImages.length > 0 ? `
                <div class="image-library-section">
                    <div class="image-library-heading">Library</div>
                    <div class="image-library-grid">
                        ${libraryImages.map((dataUrl, i) => `
                            <div class="image-library-item" data-library-index="${i}">
                                <img src="${dataUrl}" alt="Library image" />
                            </div>
                        `).join('')}
                    </div>
                </div>
        ` : '';

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
                ${libraryHTML}
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

        // Library thumbnail click handlers
        dialog.querySelectorAll('.image-library-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.libraryIndex);
                const dataUrl = libraryImages[idx];
                imageTilesSystem.setGroupImage(x, y, dataUrl);
                preview.innerHTML = `<img src="${dataUrl}" alt="Uploaded image" />`;
                this._addRemoveButton(dialog, x, y, preview);
                window.drawMap();
                this.scheduleAutoSave();
            });
        });

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

    _getImageLibrary(x, y) {
        const currentGroup = imageTilesSystem.getGroup(x, y);
        const currentImageData = currentGroup ? currentGroup.imageData : null;
        const seen = new Set();
        const images = [];
        for (const group of imageTilesSystem.getAllGroups()) {
            if (!group.imageData) continue;
            if (group.imageData === currentImageData) continue;
            if (seen.has(group.imageData)) continue;
            seen.add(group.imageData);
            images.push(group.imageData);
        }
        return images;
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

        try {
            const mapData = this.convertMapToJSON();
            await saveMapToSupabase(
                mapData,
                'My World',
                '',
                true,
                window.currentMapId
            );
        } catch (err) {
            console.error('Auto-save failed:', err);
            this.showSaveIndicator('Save failed');
            setTimeout(() => this.hideSaveIndicator(), 3000);
        } finally {
            this.isSaving = false;
        }
    }

    // Help system: ? button with tool tips and status messages
    createHelpSystem() {
        this.helpSystemEl = document.createElement('div');
        this.helpSystemEl.id = 'editor-help-system';

        this.tipBubble = document.createElement('div');
        this.tipBubble.className = 'editor-tip-bubble hidden';
        this.helpSystemEl.appendChild(this.tipBubble);

        const helpBtn = document.createElement('button');
        helpBtn.className = 'editor-help-btn';
        helpBtn.textContent = '?';
        helpBtn.title = 'Toggle tool tips';
        if (this.tipsCollapsed) helpBtn.classList.add('collapsed');
        helpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.tipsCollapsed = !this.tipsCollapsed;
            localStorage.setItem('editorTipsCollapsed', this.tipsCollapsed);
            helpBtn.classList.toggle('collapsed', this.tipsCollapsed);
            this.updateToolTip();
        });
        this.helpSystemEl.appendChild(helpBtn);

        this.statusEl = document.createElement('div');
        this.statusEl.className = 'editor-status-msg';

        document.body.appendChild(this.helpSystemEl);
        document.body.appendChild(this.statusEl);
    }

    destroyHelpSystem() {
        if (this.helpSystemEl) {
            this.helpSystemEl.remove();
            this.helpSystemEl = null;
            this.tipBubble = null;
        }
        if (this.statusEl) {
            this.statusEl.remove();
            this.statusEl = null;
        }
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
            this.statusTimeout = null;
        }
        const old = document.getElementById('autosave-indicator');
        if (old) old.remove();
    }

    updateToolTip() {
        if (!this.tipBubble) return;
        if (this.tipsCollapsed || !this.selectedTool) {
            this.tipBubble.classList.add('hidden');
            return;
        }
        let tip = this.toolTips[this.selectedTool.id];
        if (tip) {
            if (this.defaultRotation && isRotatable(this.selectedTool.tileType)) {
                tip += ` (${this.defaultRotation}\u00b0)`;
            }
            this.tipBubble.textContent = tip;
            this.tipBubble.classList.remove('hidden');
        } else {
            this.tipBubble.classList.add('hidden');
        }
    }

    showSaveIndicator(text) {
        if (!this.statusEl) return;
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
            this.statusTimeout = null;
        }
        this.statusEl.textContent = text;
        this.statusEl.classList.add('visible');
    }

    hideSaveIndicator() {
        if (!this.statusEl) return;
        this.statusEl.classList.remove('visible');
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
        } else if (tool.structureType === 'PORTAL') {
            if (!window.portals) window.portals = [];
            window.portals.push({ x, y, w: width, h: height, url: '' });
        }
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
    }

    placeTextTile(x, y) {
        const tiles = map[y][x];
        const topTile = tiles[tiles.length - 1];

        // Don't place on structures
        if (topTile.color === 'white' && !topTile.passable) return;

        // Don't place if already a text tile or image tile here
        if (textTilesSystem.hasTile(x, y)) return;
        if (imageTilesSystem.hasTile(x, y)) return;

        // Set the tile layer to TEXT type (on top of base)
        if (tiles.length > 1) {
            // Remove existing resource overlay if any
            const top = tiles[tiles.length - 1];
            if (top.resource) tiles.pop();
        }
        tiles.push(tileTypes.TEXT);

        // Register in text tile system
        textTilesSystem.addTile(x, y);
    }

    showInlineTextEditor(x, y) {
        // Close any existing editor (saves it)
        if (this.inlineTextEditor) {
            this.saveInlineTextEditor();
        }

        const groupId = textTilesSystem.getGroupId(x, y);
        if (!groupId) return;

        const group = textTilesSystem.getGroup(x, y);
        const currentHtml = (group && group.htmlContent) || '';

        // Get group bounds from the text tiles system
        const allGroups = textTilesSystem.getAllGroups();
        const groupInfo = allGroups.find(g => g.groupId === groupId);
        if (!groupInfo) return;

        const svgRect = this.svg.getBoundingClientRect();
        const offsetX = window.MAP_OFFSET_X || 0;
        const offsetY = window.MAP_OFFSET_Y || 0;
        const tileSize = window.TILE_SIZE || 32;

        const screenLeft = svgRect.left + offsetX + groupInfo.x * tileSize;
        const screenTop = svgRect.top + offsetY + groupInfo.y * tileSize;
        const blockWidth = Math.max(200, groupInfo.width * tileSize);
        const blockHeight = groupInfo.height * tileSize;
        const fontSize = Math.max(12, tileSize * 0.5);

        // Hide SVG text block elements
        const svgElements = this.svg.querySelectorAll(`[data-text-block="${groupId}"]`);
        svgElements.forEach(el => el.style.display = 'none');

        // Create inline editor container
        const container = document.createElement('div');
        container.id = 'inline-text-editor';
        container.style.left = screenLeft + 'px';
        container.style.top = screenTop + 'px';
        container.style.width = blockWidth + 'px';
        container.style.minHeight = blockHeight + 'px';

        // Create contenteditable area
        const editArea = document.createElement('div');
        editArea.id = 'text-edit-area';
        editArea.contentEditable = 'true';
        editArea.style.fontSize = fontSize + 'px';
        editArea.style.lineHeight = '1.3';
        editArea.style.minHeight = blockHeight + 'px';
        editArea.innerHTML = currentHtml;
        container.appendChild(editArea);

        document.body.appendChild(container);

        // Create toolbar
        this.showInlineTextToolbar(screenLeft, screenTop, blockWidth, blockHeight);

        // Wrap drawMap to keep SVG elements hidden and reposition editor during editing
        const originalDrawMap = window.drawMap;
        window.drawMap = (...args) => {
            originalDrawMap(...args);
            // Re-hide SVG elements after redraw
            const els = this.svg.querySelectorAll(`[data-text-block="${groupId}"]`);
            els.forEach(el => el.style.display = 'none');
            // Reposition editor based on new SVG position
            const newSvgRect = this.svg.getBoundingClientRect();
            const newOffsetX = window.MAP_OFFSET_X || 0;
            const newOffsetY = window.MAP_OFFSET_Y || 0;
            const newTileSize = window.TILE_SIZE || 32;
            const newLeft = newSvgRect.left + newOffsetX + groupInfo.x * newTileSize;
            const newTop = newSvgRect.top + newOffsetY + groupInfo.y * newTileSize;
            container.style.left = newLeft + 'px';
            container.style.top = newTop + 'px';
            const toolbar = document.getElementById('inline-text-toolbar');
            if (toolbar) {
                toolbar.style.left = newLeft + 'px';
                const toolbarAboveTop = newTop - toolbar.offsetHeight - 6;
                toolbar.style.top = (toolbarAboveTop < 4 ? newTop + (groupInfo.height * newTileSize) + 6 : toolbarAboveTop) + 'px';
            }
        };

        // Click-outside handler (capture phase, delayed)
        setTimeout(() => {
            this._inlineTextClickOutsideHandler = (e) => {
                const editorEl = document.getElementById('inline-text-editor');
                const toolbarEl = document.getElementById('inline-text-toolbar');
                if (editorEl && editorEl.contains(e.target)) return;
                if (toolbarEl && toolbarEl.contains(e.target)) return;
                this.saveInlineTextEditor();
            };
            window.addEventListener('click', this._inlineTextClickOutsideHandler, true);
        }, 100);

        // Keyboard shortcuts
        editArea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelInlineTextEditor();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.saveInlineTextEditor();
            }
        });

        // Store state
        this.inlineTextEditor = {
            x, y, groupId, container, editArea,
            originalDrawMap, currentHtml
        };

        // Focus
        setTimeout(() => editArea.focus(), 50);
    }

    showInlineTextToolbar(screenLeft, screenTop, _blockWidth, blockHeight) {
        const toolbar = document.createElement('div');
        toolbar.id = 'inline-text-toolbar';

        toolbar.style.left = screenLeft + 'px';

        // Font dropdown
        const fontDropdown = this.createFontDropdown();

        // Font size select
        const fontSizeSelect = document.createElement('select');
        fontSizeSelect.id = 'text-font-size';
        fontSizeSelect.innerHTML = `
            <option value="1">XS</option>
            <option value="2">Small</option>
            <option value="3" selected>Medium</option>
            <option value="5">Large</option>
            <option value="7">XL</option>
        `;
        fontSizeSelect.addEventListener('mousedown', (e) => e.stopPropagation());
        fontSizeSelect.addEventListener('change', (e) => {
            const editArea = document.getElementById('text-edit-area');
            if (editArea) editArea.focus();
            document.execCommand('fontSize', false, e.target.value);
        });

        // Format buttons
        const boldBtn = this._createFormatBtn('<b>B</b>', 'Bold', 'bold');
        const italicBtn = this._createFormatBtn('<i>I</i>', 'Italic', 'italic');
        const underlineBtn = this._createFormatBtn('<u>U</u>', 'Underline', 'underline');

        // Color picker
        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.id = 'text-color-picker';
        colorPicker.value = '#ffffff';
        colorPicker.title = 'Text color';
        colorPicker.style.cssText = 'width:28px;height:28px;border:none;background:none;cursor:pointer;padding:0;';
        colorPicker.addEventListener('input', (e) => {
            const editArea = document.getElementById('text-edit-area');
            if (editArea) editArea.focus();
            document.execCommand('foreColor', false, e.target.value);
        });

        // Background color picker
        const bgColorPicker = document.createElement('input');
        bgColorPicker.type = 'color';
        bgColorPicker.id = 'text-bg-color-picker';
        bgColorPicker.value = '#000000';
        bgColorPicker.title = 'Background color';
        bgColorPicker.style.cssText = 'width:28px;height:28px;border:2px solid #666;border-radius:4px;background:none;cursor:pointer;padding:0;';
        bgColorPicker.addEventListener('input', (e) => {
            const editArea = document.getElementById('text-edit-area');
            if (editArea) editArea.focus();
            document.execCommand('hiliteColor', false, e.target.value);
        });

        // Save and Cancel buttons
        const saveBtn = document.createElement('button');
        saveBtn.className = 'inline-text-save';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.saveInlineTextEditor();
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'inline-text-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.cancelInlineTextEditor();
        });

        // Alignment buttons
        const alignBarStyle = 'display:block;height:2px;background:#eee;margin:1.5px 0;';
        const alignLeftBtn = this._createFormatBtn(
            `<span style="display:inline-block;width:14px"><span style="${alignBarStyle}width:100%"></span><span style="${alignBarStyle}width:70%"></span><span style="${alignBarStyle}width:100%"></span><span style="${alignBarStyle}width:50%"></span></span>`,
            'Align left', 'justifyLeft');
        const alignCenterBtn = this._createFormatBtn(
            `<span style="display:flex;flex-direction:column;align-items:center;width:14px"><span style="${alignBarStyle}width:100%"></span><span style="${alignBarStyle}width:70%"></span><span style="${alignBarStyle}width:100%"></span><span style="${alignBarStyle}width:50%"></span></span>`,
            'Align center', 'justifyCenter');
        const alignRightBtn = this._createFormatBtn(
            `<span style="display:flex;flex-direction:column;align-items:flex-end;width:14px"><span style="${alignBarStyle}width:100%"></span><span style="${alignBarStyle}width:70%"></span><span style="${alignBarStyle}width:100%"></span><span style="${alignBarStyle}width:50%"></span></span>`,
            'Align right', 'justifyRight');

        toolbar.appendChild(fontDropdown);
        toolbar.appendChild(fontSizeSelect);
        toolbar.appendChild(boldBtn);
        toolbar.appendChild(italicBtn);
        toolbar.appendChild(underlineBtn);
        toolbar.appendChild(colorPicker);
        toolbar.appendChild(bgColorPicker);
        toolbar.appendChild(alignLeftBtn);
        toolbar.appendChild(alignCenterBtn);
        toolbar.appendChild(alignRightBtn);
        toolbar.appendChild(saveBtn);
        toolbar.appendChild(cancelBtn);

        document.body.appendChild(toolbar);

        // Reposition using actual rendered height
        const actualHeight = toolbar.offsetHeight;
        const aboveTopActual = screenTop - actualHeight - 6;
        if (aboveTopActual < 4) {
            toolbar.style.top = (screenTop + blockHeight + 6) + 'px';
        } else {
            toolbar.style.top = aboveTopActual + 'px';
        }
    }

    _createFormatBtn(innerHTML, title, cmd) {
        const btn = document.createElement('button');
        btn.className = 'text-format-btn';
        btn.innerHTML = innerHTML;
        btn.title = title;
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            document.execCommand(cmd, false, null);
        });
        return btn;
    }

    createFontDropdown() {
        const wrapper = document.createElement('div');
        wrapper.className = 'font-dropdown-wrapper';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'font-dropdown-input';
        input.value = 'sans-serif';
        input.title = 'Font family — type to filter';

        const list = document.createElement('div');
        list.className = 'font-dropdown-list';
        list.style.display = 'none';

        const renderOptions = (filter) => {
            list.innerHTML = '';
            const filtered = filter
                ? WEB_SAFE_FONTS.filter(f => f.label.toLowerCase().includes(filter.toLowerCase()))
                : WEB_SAFE_FONTS;
            filtered.forEach(font => {
                const option = document.createElement('div');
                option.className = 'font-dropdown-option';
                option.textContent = font.label;
                option.style.fontFamily = font.value;
                option.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    input.value = font.label;
                    list.style.display = 'none';
                    const editArea = document.getElementById('text-edit-area');
                    if (editArea) editArea.focus();
                    document.execCommand('fontName', false, font.value);
                });
                list.appendChild(option);
            });
        };

        input.addEventListener('focus', () => {
            input.select();
            renderOptions('');
            list.style.display = 'block';
        });

        input.addEventListener('input', () => {
            renderOptions(input.value);
            list.style.display = 'block';
        });

        input.addEventListener('blur', () => {
            // Delay so mousedown on option fires first
            setTimeout(() => { list.style.display = 'none'; }, 150);
        });

        // Prevent clicks inside dropdown from stealing focus from contenteditable
        input.addEventListener('mousedown', (e) => e.stopPropagation());
        list.addEventListener('mousedown', (e) => e.stopPropagation());

        wrapper.appendChild(input);
        wrapper.appendChild(list);
        return wrapper;
    }

    saveInlineTextEditor() {
        if (!this.inlineTextEditor) return;
        const { x, y, editArea } = this.inlineTextEditor;
        const html = editArea.innerHTML.trim();
        textTilesSystem.setGroupHtml(x, y, html || null);
        this.closeInlineTextEditor();
        window.drawMap();
        this.scheduleAutoSave();
        this.showSaveIndicator('Text saved');
        setTimeout(() => this.hideSaveIndicator(), 1500);
    }

    cancelInlineTextEditor() {
        if (!this.inlineTextEditor) return;
        this.closeInlineTextEditor();
        window.drawMap();
    }

    closeInlineTextEditor() {
        if (!this.inlineTextEditor) return;

        const { originalDrawMap, groupId } = this.inlineTextEditor;

        // Restore original drawMap
        window.drawMap = originalDrawMap;

        // Remove DOM elements
        const editorEl = document.getElementById('inline-text-editor');
        if (editorEl) editorEl.remove();
        const toolbarEl = document.getElementById('inline-text-toolbar');
        if (toolbarEl) toolbarEl.remove();

        // Remove click-outside listener
        if (this._inlineTextClickOutsideHandler) {
            window.removeEventListener('click', this._inlineTextClickOutsideHandler, true);
            this._inlineTextClickOutsideHandler = null;
        }

        // Restore SVG elements visibility
        const svgElements = this.svg.querySelectorAll(`[data-text-block="${groupId}"]`);
        svgElements.forEach(el => el.style.display = '');

        this.inlineTextEditor = null;
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

        // Check portals
        if (!structureFound && window.portals) {
            const portalIndex = window.portals.findIndex(p => this.isInStructure(x, y, p));
            if (portalIndex >= 0) {
                this.removeStructure(window.portals[portalIndex], 'PORTAL');
                window.portals.splice(portalIndex, 1);
                structureFound = true;
            }
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
    }

    redrawStructures() {
        // Remove existing structure images
        const existingStructures = this.svg.querySelectorAll('image');
        existingStructures.forEach(img => {
            const href = img.getAttribute('href');
            if (href && (href.includes('farmhouse') || href.includes('chicken-coop') || href.includes('sign-joshuagraham') || href.includes('portal-purple'))) {
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

        // Redraw portals
        if (window.portals) {
            window.portals.forEach(portal => {
                const imgPortal = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                imgPortal.setAttribute('href', getSpriteUrl('portal-purple.gif'));
                imgPortal.setAttribute('x', portal.x * window.TILE_SIZE);
                imgPortal.setAttribute('y', portal.y * window.TILE_SIZE);
                imgPortal.setAttribute('width', portal.w * window.TILE_SIZE);
                imgPortal.setAttribute('height', portal.h * window.TILE_SIZE);
                this.svg.appendChild(imgPortal);
            });
        }
    }

    convertMapDataToGameFormat(mapData) {
        // Initialize empty map array
        clearAllTileRotations();
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
                    case 'FLOWER_ROSE': return tileTypes.FLOWER_ROSE;
                    case 'FLOWER_FORGETMENOT': return tileTypes.FLOWER_FORGETMENOT;
                    case 'FLOWER_TULIP': return tileTypes.FLOWER_TULIP;
                    case 'FLOWER_BLUEBELL': return tileTypes.FLOWER_BLUEBELL;
                    case 'EGG': return tileTypes.EGG;
                    case 'BADGE': return tileTypes.BADGE;
                    case 'IMAGE': return tileTypes.IMAGE;
                    case 'TEXT': return tileTypes.TEXT;
                    case 'GRASS_EDGE': return tileTypes.GRASS_EDGE;
                    case 'GRASS_CORNER': return tileTypes.GRASS_CORNER;
                    case 'GRASS_CORNER_INSIDE': return tileTypes.GRASS_CORNER_INSIDE;
                    default: return tileTypes.GRASS;
                }
            });
            if (tile.rotations) {
                setTileRotations(tile.x, tile.y, tile.rotations);
            } else if (tile.rotation) {
                setTileRotation(tile.x, tile.y, tile.rotation);
            }
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
                        if (layer === tileTypes.BRIDGE_H) return 'BRIDGE_H';
                        if (layer === tileTypes.BRIDGE_V) return 'BRIDGE_V';
                        if (layer === tileTypes.LARGE_TREE) return 'LARGE_TREE';
                        if (layer === tileTypes.BUSH) return 'BUSH';
                        if (layer === tileTypes.PINE_TREE) return 'PINE_TREE';
                        if (layer === tileTypes.ROCK) return 'ROCK';
                        if (layer === tileTypes.FLOWER) return 'FLOWER';
                        if (layer === tileTypes.FLOWER_ROSE) return 'FLOWER_ROSE';
                        if (layer === tileTypes.FLOWER_FORGETMENOT) return 'FLOWER_FORGETMENOT';
                        if (layer === tileTypes.FLOWER_TULIP) return 'FLOWER_TULIP';
                        if (layer === tileTypes.FLOWER_BLUEBELL) return 'FLOWER_BLUEBELL';
                        if (layer === tileTypes.EGG) return 'EGG';
                        if (layer === tileTypes.BADGE) return 'BADGE';
                        if (layer === tileTypes.IMAGE) return 'IMAGE';
                        if (layer === tileTypes.TEXT) return 'TEXT';
                        if (layer === tileTypes.GRASS_EDGE) return 'GRASS_EDGE';
                        if (layer === tileTypes.GRASS_CORNER) return 'GRASS_CORNER';
                        if (layer === tileTypes.GRASS_CORNER_INSIDE) return 'GRASS_CORNER_INSIDE';
                        return 'WATER';
                    });

                    const rotations = getTileRotations(x, y);
                    const tileEntry = { x, y, layers };
                    if (rotations.length === 1) {
                        tileEntry.rotation = rotations[0];
                    } else if (rotations.length > 1) {
                        tileEntry.rotations = rotations;
                    }
                    tiles.push(tileEntry);

                    // Check for resources
                    const topLayer = tileLayers[tileLayers.length - 1];
                    if (topLayer === tileTypes.LARGE_TREE ||
                        topLayer === tileTypes.BUSH ||
                        topLayer === tileTypes.PINE_TREE ||
                        topLayer === tileTypes.ROCK ||
                        topLayer === tileTypes.FLOWER ||
                        topLayer === tileTypes.FLOWER_ROSE ||
                        topLayer === tileTypes.FLOWER_FORGETMENOT ||
                        topLayer === tileTypes.FLOWER_TULIP ||
                        topLayer === tileTypes.FLOWER_BLUEBELL ||
                        topLayer === tileTypes.EGG ||
                        topLayer === tileTypes.BADGE) {
                        let resourceType = 'LARGE_TREE';
                        if (topLayer === tileTypes.BUSH) resourceType = 'BUSH';
                        else if (topLayer === tileTypes.PINE_TREE) resourceType = 'PINE_TREE';
                        else if (topLayer === tileTypes.ROCK) resourceType = 'ROCK';
                        else if (topLayer === tileTypes.FLOWER) resourceType = 'FLOWER';
                        else if (topLayer === tileTypes.FLOWER_ROSE) resourceType = 'FLOWER_ROSE';
                        else if (topLayer === tileTypes.FLOWER_FORGETMENOT) resourceType = 'FLOWER_FORGETMENOT';
                        else if (topLayer === tileTypes.FLOWER_TULIP) resourceType = 'FLOWER_TULIP';
                        else if (topLayer === tileTypes.FLOWER_BLUEBELL) resourceType = 'FLOWER_BLUEBELL';
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
            portals: (window.portals || []).map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h, url: p.url })),
            introText: window.currentMapIntroText || null,
            pageTitle: window.currentMapPageTitle || null,
            collectables: collectablesSystem.toMapData(),
            imageTiles: imageTilesSystem.toMapData(),
            textTiles: textTilesSystem.toMapData()
        };
    }

    showWorldSettingsDialog() {
        const existing = document.getElementById('world-settings-dialog');
        if (existing) existing.remove();

        const currentTitle = window.currentMapPageTitle || '';
        const currentIntro = window.currentMapIntroText || '';

        const dialog = document.createElement('div');
        dialog.id = 'world-settings-dialog';
        dialog.innerHTML = `
            <div class="cloud-save-panel world-settings-panel">
                <h3>World Settings</h3>

                <label class="world-settings-label">Page Title</label>
                <p class="world-settings-hint">Shown in the browser tab for visitors.</p>
                <input type="text" id="world-settings-title" placeholder="My World" value="${currentTitle}" />

                <label class="world-settings-label">Welcome Message</label>
                <p class="world-settings-hint">Shown when visitors first arrive. Leave blank for default.</p>
                <textarea id="world-settings-intro" rows="4" placeholder="Enter your welcome message...">${currentIntro}</textarea>

                <div class="cloud-save-actions">
                    <button id="world-settings-save" class="auth-btn auth-btn-primary">Save</button>
                    <button id="world-settings-cancel" class="auth-btn auth-btn-secondary">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        document.getElementById('world-settings-cancel').addEventListener('click', () => {
            dialog.remove();
        });

        document.getElementById('world-settings-save').addEventListener('click', () => {
            const newTitle = document.getElementById('world-settings-title').value.trim();
            const newIntro = document.getElementById('world-settings-intro').value.trim();

            window.currentMapPageTitle = newTitle || null;
            window.currentMapIntroText = newIntro || null;

            if (newTitle) {
                document.title = `${newTitle} - maap.to`;
            }

            dialog.remove();
            this.scheduleAutoSave();
        });

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
                    Upgrade to unlock NPCs, larger maps, and an ad-free experience for your visitors.
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

        // Shift portal positions
        if (window.portals) {
            window.portals.forEach(portal => {
                portal.x += offsetX;
                portal.y += offsetY;
            });
        }

        // Shift player position
        if (window.player) {
            window.player.x += offsetX;
            window.player.y += offsetY;
        }

        // Shift collectable positions
        collectablesSystem.shiftPositions(offsetX, offsetY);

        // Shift text tile positions
        textTilesSystem.shiftPositions(offsetX, offsetY);

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

    expandMap(newWidth, newHeight) {
        const oldWidth = MAP_WIDTH_TILES;
        const oldHeight = MAP_HEIGHT_TILES;

        // Only expand, never shrink
        const targetWidth = Math.max(oldWidth, newWidth);
        const targetHeight = Math.max(oldHeight, newHeight);

        if (targetWidth === oldWidth && targetHeight === oldHeight) return;

        // Create new map filled with water, copy existing tiles at (0,0) origin
        const newMap = Array(targetHeight).fill(null).map((_, y) =>
            Array(targetWidth).fill(null).map((_, x) => {
                if (y < oldHeight && x < oldWidth) {
                    return map[y][x];
                }
                return [tileTypes.WATER];
            })
        );

        // Update the map — no coordinate shifting needed
        replaceMap(newMap, targetWidth, targetHeight);

        // Recalculate tile size and redraw
        if (window.updateTileSize) window.updateTileSize();
        window.drawMap();

        // Update entity positions visually (coordinates unchanged, pixel positions may shift due to tile size)
        if (window.player) window.player.updatePosition();
        if (window.npcs) window.npcs.forEach(npc => npc.updatePosition());
        if (window.chickens) window.chickens.forEach(c => c.updatePosition());
        if (window.cockerels) window.cockerels.forEach(c => c.updatePosition());

        // Update viewport for mobile
        if (window.updateViewport) window.updateViewport();

        // Auto-save the expanded map
        this.scheduleAutoSave();
    }
}