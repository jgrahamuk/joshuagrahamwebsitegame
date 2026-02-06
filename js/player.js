import { tileTypes, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, map, removeResource, getResourceAt } from './map.js';
import { findPath } from './movement.js';
import { getSpriteUrl } from './spriteCache.js';
import { badgeSystem } from './badgeSystem.js';
import { collectablesSystem } from './collectables.js';

export class Player {
    constructor(svg, startX, startY, options = {}) {
        // Options: { skipIntro: false, introText: null }
        const skipIntro = options.skipIntro || false;
        const introText = options.introText || "Hey! Check out this website. Isn't it snazzy?! Just click anywhere on the map and I'll go there.<br /><br />Maybe you should go talk to Joshua, as this is his website. you'll find him somewhere on the island. He's wearing a flannel shirt.";
        this.introText = introText;
        // Validate starting position
        const startTile = getTile(startX, startY);
        if (!startTile || (startTile !== tileTypes.GRASS && startTile !== tileTypes.DIRT)) {
            console.error('Invalid player starting position, must be on grass or dirt');
            // Find nearest valid tile
            let found = false;
            let radius = 1;
            while (!found && radius < Math.max(MAP_WIDTH_TILES, MAP_HEIGHT_TILES)) {
                for (let dy = -radius; dy <= radius && !found; dy++) {
                    for (let dx = -radius; dx <= radius && !found; dx++) {
                        const newX = startX + dx;
                        const newY = startY + dy;
                        if (newX >= 0 && newX < MAP_WIDTH_TILES && newY >= 0 && newY < MAP_HEIGHT_TILES) {
                            const tile = getTile(newX, newY);
                            if (tile === tileTypes.GRASS || tile === tileTypes.DIRT) {
                                startX = newX;
                                startY = newY;
                                found = true;
                            }
                        }
                    }
                }
                radius++;
            }
        }

        this.x = startX;
        this.y = startY;
        this.direction = 'front';
        this.element = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        this.svg = svg;
        this.svg.appendChild(this.element);
        this.targetResource = null; // Track if we're moving to gather a resource
        this.isWalking = false;
        this.walkFrame = 0;
        this.lastWalkToggle = 0;
        this.walkToggleInterval = 150; // ms between walk frame changes

        // Initialize inventory
        this.inventory = {
            wood: 0,
            stone: 0,
            eggs: 0,
            badges: 0
        };

        // Intro sequence state
        this.isInIntro = !skipIntro;
        this.introScale = 2;
        this.introMessageContainer = null;
        this.introTimeout = null;

        this.updatePosition();
        this.updateInventoryDisplay();

        if (this.isInIntro) {
            this.showIntroSequence();
        }
    }

    showIntroSequence() {
        // Create blur overlay
        this.blurOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        this.blurOverlay.setAttribute('x', 0);
        this.blurOverlay.setAttribute('y', 0);
        this.blurOverlay.setAttribute('width', window.innerWidth);
        this.blurOverlay.setAttribute('height', window.innerHeight);
        this.blurOverlay.setAttribute('fill', 'rgba(0, 0, 0, 0.3)');

        // Create and apply blur filter
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        filter.setAttribute('id', 'blur-filter');
        const gaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
        gaussianBlur.setAttribute('stdDeviation', '4');
        filter.appendChild(gaussianBlur);
        defs.appendChild(filter);
        this.svg.appendChild(defs);

        this.blurOverlay.style.filter = 'url(#blur-filter)';

        // Ensure proper layering
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.svg.appendChild(this.blurOverlay);
        this.svg.appendChild(this.element);

        // Position in center of screen
        const screenCenterX = window.innerWidth / 2;
        const screenCenterY = window.innerHeight / 2;

        // Position character in center
        const characterWidth = window.TILE_SIZE * 2 * this.introScale;
        const characterHeight = window.TILE_SIZE * 2 * this.introScale;
        const characterX = screenCenterX - (characterWidth / 2);
        const characterY = screenCenterY - (characterHeight / 2);

        // Ensure character sprite is set correctly
        this.element.setAttribute('href', getSpriteUrl('character-front.gif'));
        this.element.setAttribute('x', characterX);
        this.element.setAttribute('y', characterY);
        this.element.setAttribute('width', characterWidth);
        this.element.setAttribute('height', characterHeight);
        this.element.style.imageRendering = 'pixelated';

        // Create chatbox container
        this.introMessageContainer = document.createElement('div');
        this.introMessageContainer.className = 'chatbox-container';

        // Calculate chatbox position - above character but clamped to viewport
        const isLandscape = window.innerWidth > window.innerHeight;
        const chatboxHeight = isLandscape ? 310 : 192;
        let topPos = characterY - chatboxHeight - 20;

        // Clamp to viewport - minimum 10px from top
        topPos = Math.max(10, topPos);

        this.introMessageContainer.style.left = '50%';
        this.introMessageContainer.style.top = `${topPos}px`;
        this.introMessageContainer.style.transform = 'translateX(-50%)';

        // Create chatbox
        const chatbox = document.createElement('div');
        chatbox.className = 'chatbox';

        // Create text element
        const textElement = document.createElement('div');
        textElement.className = 'chatbox-text';
        textElement.innerHTML = this.introText;

        // Assemble the chatbox
        chatbox.appendChild(textElement);
        this.introMessageContainer.appendChild(chatbox);
        document.body.appendChild(this.introMessageContainer);

        // Add click handler to end intro
        const clickHandler = (e) => {
            e.stopPropagation(); // Prevent click from reaching map click handler
            this.endIntroSequence();
        };
        this.svg.addEventListener('click', clickHandler, { once: true });

        // Auto-end intro after 10 seconds
        this.introTimeout = setTimeout(() => {
            if (this.isInIntro) {
                this.endIntroSequence();
            }
        }, 20000);
    }

    endIntroSequence() {
        if (!this.isInIntro) return;

        this.isInIntro = false;

        // Clear timeout if it exists
        if (this.introTimeout) {
            clearTimeout(this.introTimeout);
            this.introTimeout = null;
        }

        // Fade out intro elements
        if (this.blurOverlay) {
            let opacity = 1;
            const fadeInterval = setInterval(() => {
                opacity -= 0.1;
                if (opacity <= 0) {
                    clearInterval(fadeInterval);
                    if (this.blurOverlay.parentNode) {
                        this.blurOverlay.parentNode.removeChild(this.blurOverlay);
                    }
                } else {
                    this.blurOverlay.setAttribute('fill-opacity', opacity);
                }
            }, 50);
        }

        // Fade out chatbox
        if (this.introMessageContainer) {
            let opacity = 1;
            const fadeInterval = setInterval(() => {
                opacity -= 0.1;
                if (opacity <= 0) {
                    clearInterval(fadeInterval);
                    this.introMessageContainer.remove();
                    this.introMessageContainer = null;
                } else {
                    this.introMessageContainer.style.opacity = opacity;
                }
            }, 50);
        }

        // Animate character scale down and move to position
        let scale = this.introScale;
        const targetX = (window.MAP_OFFSET_X || 0) + this.x * window.TILE_SIZE;
        const targetY = (window.MAP_OFFSET_Y || 0) + this.y * window.TILE_SIZE;
        const startX = parseFloat(this.element.getAttribute('x'));
        const startY = parseFloat(this.element.getAttribute('y'));
        const dx = targetX - startX;
        const dy = targetY - startY;

        const animate = () => {
            scale -= 0.1;
            if (scale <= 1) {
                scale = 1;
                this.updatePosition();
                // Center viewport on player after intro (for mobile)
                if (window.updateViewport) window.updateViewport();
                return;
            }

            const progress = (this.introScale - scale) / (this.introScale - 1);
            const currentX = startX + dx * progress;
            const currentY = startY + dy * progress;

            this.element.setAttribute('x', currentX);
            this.element.setAttribute('y', currentY);
            this.element.setAttribute('width', window.TILE_SIZE * 2 * scale);
            this.element.setAttribute('height', window.TILE_SIZE * 2 * scale);

            requestAnimationFrame(animate);
        };

        animate();
    }

    updatePosition() {
        if (this.isInIntro) return;

        let sprite = `character-${this.direction}.gif`;

        // Add walking animation for left/right movement
        if (this.isWalking && (this.direction === 'left' || this.direction === 'right')) {
            const now = Date.now();
            if (now - this.lastWalkToggle > this.walkToggleInterval) {
                this.walkFrame = (this.walkFrame + 1) % 2;
                this.lastWalkToggle = now;
            }

            if (this.walkFrame === 1) {
                sprite = `character-${this.direction}-walk.gif`;
            }
        }

        this.element.setAttribute('href', getSpriteUrl(sprite));
        this.element.setAttribute('x', (window.MAP_OFFSET_X || 0) + this.x * window.TILE_SIZE);
        this.element.setAttribute('y', (window.MAP_OFFSET_Y || 0) + this.y * window.TILE_SIZE);
        this.element.setAttribute('width', window.TILE_SIZE * 2);
        this.element.setAttribute('height', window.TILE_SIZE * 2);
        this.element.style.imageRendering = 'pixelated';
    }
    async moveTo(path, targetResource = null, interactionData = null) {
        this.targetResource = targetResource; // Set the target resource if provided
        this.interactionData = interactionData; // Set interaction data if provided
        let last = { x: this.x, y: this.y };

        // Check if we're already adjacent to the resource (no movement needed)
        if (this.targetResource && this.isAdjacentToResource(this.targetResource)) {
            this.gatherResource(this.targetResource);
            this.targetResource = null;
            return;
        }

        // Start walking animation
        this.isWalking = true;
        this.walkFrame = 0;
        this.lastWalkToggle = Date.now();

        for (const point of path) {
            if (point.x > last.x) this.direction = 'right';
            else if (point.x < last.x) this.direction = 'left';
            else if (point.y > last.y) this.direction = 'front';
            else if (point.y < last.y) this.direction = 'back';
            last = { ...point };
            this.x = point.x;
            this.y = point.y;
            this.updatePosition();

            // Update viewport to follow player on mobile
            if (window.updateViewport) window.updateViewport();

            // Check if we've reached our destination and should interact
            if (this.targetResource && this.isAdjacentToResource(this.targetResource)) {
                this.gatherResource(this.targetResource);
                this.targetResource = null; // Clear the target
            }

            if (this.interactionData && this.interactionData.type === 'npc') {
                this.checkNPCInteraction(this.interactionData.data);
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Stop walking animation
        this.isWalking = false;
        this.updatePosition();

        // Clear interaction data after movement completes
        this.interactionData = null;
    }

    isAdjacentToResource(resourcePos) {
        const dx = Math.abs(this.x - resourcePos.x);
        const dy = Math.abs(this.y - resourcePos.y);
        return dx <= 1 && dy <= 1;
    }

    gatherResource(resourcePos) {
        // Check for collectable text before removing
        const collectable = collectablesSystem.getCollectable(resourcePos.x, resourcePos.y);

        // Check if this is a user world (not demo)
        const isUserWorld = !!window.currentMapId;

        // Owner should not collect items (they're in edit mode)
        if (isUserWorld && window.isMapOwner) {
            return;
        }

        // Guest viewing someone else's world - visual collection only
        if (isUserWorld && !window.isMapOwner) {
            if (collectable) {
                // Mark as collected and show message
                collectablesSystem.markCollected(resourcePos.x, resourcePos.y);
                this.removeResourceElement(resourcePos);
                this.updateInventoryDisplay();

                if (collectable.text) {
                    collectablesSystem.showCollectionMessage(collectable.text);
                }
            }
            return;
        }

        // Demo world - normal resource gathering with map modification
        const removedResource = removeResource(resourcePos.x, resourcePos.y);

        if (removedResource) {
            // Add to inventory based on resource type
            if (removedResource.resource === 'wood') {
                this.inventory.wood++;
            } else if (removedResource.resource === 'stone') {
                this.inventory.stone++;
            } else if (removedResource.resource === 'egg') {
                this.inventory.eggs++;
            } else if (removedResource.resource === 'badge') {
                // Handle badge collection through badge system
                if (badgeSystem.handleBadgeCollection(resourcePos)) {
                    this.inventory.badges++;
                }
            }

            // Update the display
            this.updateInventoryDisplay();

            // Remove the visual element from SVG (for non-badge resources)
            if (removedResource.resource !== 'badge') {
                this.removeResourceElement(resourcePos);
            }

            // Show collection message if this was a collectable
            if (collectable && collectable.text) {
                collectablesSystem.markCollected(resourcePos.x, resourcePos.y);
                collectablesSystem.showCollectionMessage(collectable.text);
            }
        }
    }

    removeResourceElement(resourcePos) {
        const resourceX = (window.MAP_OFFSET_X || 0) + resourcePos.x * window.TILE_SIZE;
        const resourceY = (window.MAP_OFFSET_Y || 0) + resourcePos.y * window.TILE_SIZE;
        const resourceElements = this.svg.querySelectorAll('image[data-resource]');

        resourceElements.forEach(element => {
            const x = parseFloat(element.getAttribute('x'));
            const y = parseFloat(element.getAttribute('y'));
            const width = parseFloat(element.getAttribute('width'));
            const height = parseFloat(element.getAttribute('height'));

            // Calculate center points for both the target position and the element
            const targetCenterX = resourceX + window.TILE_SIZE / 2;
            const targetCenterY = resourceY + window.TILE_SIZE / 2;
            const elementCenterX = x + width / 2;
            const elementCenterY = y + height / 2;

            // Check if the centers match (within a small threshold for floating point precision)
            const threshold = 0.1;
            if (Math.abs(elementCenterX - targetCenterX) < threshold &&
                Math.abs(elementCenterY - targetCenterY) < threshold) {
                element.remove();
            }
        });
    }

    checkNPCInteraction(npc) {
        // Check if we're adjacent to the NPC (they might have moved)
        if (this.isAdjacentToNPC(npc)) {
            // Dismiss other NPC messages
            if (window.npcs) {
                window.npcs.filter(otherNPC => otherNPC !== npc).forEach(otherNPC => otherNPC.hideMessage());
            }
            npc.showMessage();
            this.interactionData = null; // Clear the interaction
        }
    }

    isAdjacentToNPC(npc) {
        const dx = Math.abs(this.x - npc.x);
        const dy = Math.abs(this.y - npc.y);
        return dx <= 1 && dy <= 1;
    }

    updateInventoryDisplay() {
        const woodCountElement = document.getElementById('wood-count');
        const stoneCountElement = document.getElementById('stone-count');
        const eggsCountElement = document.getElementById('eggs-count');
        const badgesCountElement = document.getElementById('badges-count');

        if (woodCountElement) {
            woodCountElement.textContent = this.inventory.wood;
        }
        if (stoneCountElement) {
            stoneCountElement.textContent = this.inventory.stone;
        }
        if (eggsCountElement) {
            eggsCountElement.textContent = this.inventory.eggs;
        }
        if (badgesCountElement) {
            // For user worlds, use collectables system only
            // For demo world (no currentMapId), use badge system
            if (window.currentMapId) {
                badgesCountElement.textContent = collectablesSystem.getDisplayText();
            } else {
                badgesCountElement.textContent = badgeSystem.getBadgeDisplayText();
            }
        }
    }
} 