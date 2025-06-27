import { tileTypes, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, map, removeResource, getResourceAt } from './map.js';
import { findPath } from './movement.js';
import { getSpriteUrl } from './spriteCache.js';
import { badgeSystem } from './badgeSystem.js';

export class Player {
    constructor(svg, startX, startY) {
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
        this.isInIntro = true;
        this.introScale = 2;
        this.introMessageElement = null;
        this.introTextElements = [];
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
        this.svg.appendChild(this.blurOverlay);

        // Create a group for intro elements to ensure proper z-ordering
        this.introGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.introGroup.style.zIndex = '10';
        this.svg.appendChild(this.introGroup);

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

        // Move character to intro group
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.introGroup.appendChild(this.element);

        // Create chatbox background
        this.introMessageElement = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        this.introMessageElement.setAttribute('href', getSpriteUrl('chatbox.gif'));

        // Adjust chatbox size based on orientation
        const isPortrait = window.innerHeight > window.innerWidth;
        const scaleFactor = isPortrait ? 0.8 : 1; // 20% smaller in portrait mode

        // Position chatbox above character with proper spacing
        const chatboxWidth = window.TILE_SIZE * 24 * scaleFactor;
        const chatboxHeight = window.TILE_SIZE * 12 * scaleFactor;
        const chatboxX = screenCenterX - chatboxWidth / 2;
        const chatboxY = characterY - chatboxHeight - window.TILE_SIZE;

        this.introMessageElement.setAttribute('x', chatboxX);
        this.introMessageElement.setAttribute('y', chatboxY);
        this.introMessageElement.setAttribute('width', chatboxWidth);
        this.introMessageElement.setAttribute('height', chatboxHeight);
        this.introMessageElement.style.imageRendering = 'pixelated';
        this.introMessageElement.style.shapeRendering = 'crispEdges';
        this.introMessageElement.style.webkitImageRendering = 'pixelated';
        this.introMessageElement.style.mozImageRendering = 'pixelated';
        this.introMessageElement.style.msImageRendering = 'pixelated';
        this.introGroup.appendChild(this.introMessageElement);

        // Create and position text with proper wrapping
        const message = "Hey! Check out this website. Isn't it snazzy?! Just click anywhere on the map and I'll go there. There are lots of items to pick up and things to do. Maybe you should go talk to Joshua, as this is his website. you'll find him somewhere on the island. He's wearing a flannel shirt.";
        const padding = window.TILE_SIZE * 1 * scaleFactor;
        const maxWidth = chatboxWidth - padding * 4;
        const words = message.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            const estimatedWidth = testLine.length * 8 + 40; // Rough estimate of width based on character count
            if (estimatedWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        if (currentLine) {
            lines.push(currentLine);
        }

        // Create text elements for each line
        const lineHeight = window.TILE_SIZE * 0.8;
        const textStartY = chatboxY + padding * 2;
        const textStartX = chatboxX + padding * 12;

        // Create a text container group
        const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        textGroup.classList.add('npc-chatbox-text');
        this.introGroup.appendChild(textGroup);

        lines.forEach((line, index) => {
            const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textElement.setAttribute('x', textStartX);
            textElement.setAttribute('y', textStartY + index * lineHeight);
            textElement.setAttribute('width', 50);
            textElement.textContent = line;
            textElement.style.fontSize = `${Math.floor(window.TILE_SIZE * 0.8)}px`;
            textGroup.appendChild(textElement);
            this.introTextElements.push(textElement);
        });

        // Add click handler to end intro
        const clickHandler = () => this.endIntroSequence();
        this.svg.addEventListener('click', clickHandler, { once: true });

        // Auto-end intro after 10 seconds
        this.introTimeout = setTimeout(() => {
            if (this.isInIntro) {
                this.endIntroSequence();
            }
        }, 10000);
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
        const fadeOut = (element) => {
            let opacity = 1;
            const fadeInterval = setInterval(() => {
                opacity -= 0.1;
                if (opacity <= 0) {
                    clearInterval(fadeInterval);
                    if (element.parentNode) {
                        element.parentNode.removeChild(element);
                    }
                } else {
                    if (element === this.introGroup) {
                        element.style.opacity = opacity;
                    } else {
                        element.setAttribute('fill-opacity', opacity);
                    }
                }
            }, 50);
        };

        // Fade out all elements
        if (this.blurOverlay) {
            fadeOut(this.blurOverlay);
        }
        if (this.introGroup) {
            fadeOut(this.introGroup);
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
                // Move character back to main SVG
                if (this.element.parentNode) {
                    this.element.parentNode.removeChild(this.element);
                }
                this.svg.appendChild(this.element);
                this.updatePosition();
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
        // Use map.js to remove the resource and handle respawning
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

            // Check if this element is the resource at the target position
            if (x === resourceX && y === resourceY && width === window.TILE_SIZE && height === window.TILE_SIZE) {
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
            badgesCountElement.textContent = badgeSystem.getBadgeDisplayText();
        }
    }
} 