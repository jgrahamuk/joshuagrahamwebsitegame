import { tileTypes, getTile, randomGrassOrDirt, MAP_WIDTH_TILES, MAP_HEIGHT_TILES } from './map.js';
import { findPath } from './movement.js';
import { getSpriteUrl } from './spriteCache.js';
import { badgeSystem } from './badgeSystem.js';

export class NPC {
    constructor(svg, name, message, startX, startY) {
        this.name = name;
        this.message = message;
        this.hasSpokenTo = false;

        // Ensure NPC starts on valid land tile
        if (startX !== undefined && startY !== undefined) {
            this.x = startX;
            this.y = startY;
            this.originalX = startX;
            this.originalY = startY;
        } else {
            const pos = randomGrassOrDirt();
            this.x = pos.x;
            this.y = pos.y;
            this.originalX = pos.x;
            this.originalY = pos.y;
        }

        this.direction = 'front';
        this.element = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        this.svg = svg;
        this.svg.appendChild(this.element);
        console.log(`NPC ${this.name} element created and added to SVG`);

        // Movement properties
        this.lastMove = Date.now();
        this.moveInterval = 3000 + Math.random() * 4000; // 3-7 seconds
        this.path = [];
        this.moving = false;
        this.moveSpeed = 400; // ms per tile
        this.nextStepTime = 0;

        // Message display
        this.messageContainer = null;
        this.isShowingMessage = false;
        this.messageTimeout = null;

        this.updatePosition();
        console.log(`NPC ${this.name} positioned at (${this.x}, ${this.y})`);
    }

    updatePosition() {
        let sprite = `${this.name.toLowerCase()}-${this.direction}.gif`;
        this.element.setAttribute('href', getSpriteUrl(sprite));
        this.element.setAttribute('x', this.x * window.TILE_SIZE);
        this.element.setAttribute('y', this.y * window.TILE_SIZE - window.TILE_SIZE);
        this.element.setAttribute('width', window.TILE_SIZE * 2);
        this.element.setAttribute('height', window.TILE_SIZE * 2);
        this.element.style.imageRendering = 'pixelated';
    }

    moveTo(path) {
        if (path && path.length > 1) {
            this.path = path.slice(1);
            this.moving = true;
            this.nextStepTime = Date.now();
        }
    }

    tick(now) {
        // Don't move if showing message
        if (this.isShowingMessage) {
            return;
        }

        // Move along path
        if (this.moving && this.path && this.path.length > 0) {
            if (now >= this.nextStepTime) {
                const next = this.path.shift();
                if (next.x > this.x) this.direction = 'right';
                else if (next.x < this.x) this.direction = 'left';
                else if (next.y > this.y) this.direction = 'front';
                else if (next.y < this.y) this.direction = 'back';
                this.x = next.x;
                this.y = next.y;
                this.lastMove = now;
                this.updatePosition();
                this.nextStepTime = now + this.moveSpeed;
                if (this.path.length === 0) {
                    this.moving = false;
                }
            }
            return;
        }

        // Random movement within 2-3 tiles of original position
        if (!this.moving && now - this.lastMove > this.moveInterval) {
            const maxDistance = 2 + Math.floor(Math.random() * 2); // 2-3 tiles
            let tries = 0;
            while (tries < 10) {
                const dx = Math.floor(Math.random() * (maxDistance * 2 + 1)) - maxDistance;
                const dy = Math.floor(Math.random() * (maxDistance * 2 + 1)) - maxDistance;
                const nx = this.originalX + dx;
                const ny = this.originalY + dy;

                if (nx >= 0 && ny >= 0 && nx < MAP_WIDTH_TILES && ny < MAP_HEIGHT_TILES &&
                    (getTile(nx, ny) === tileTypes.GRASS || getTile(nx, ny) === tileTypes.DIRT)) {
                    const path = findPath({ x: this.x, y: this.y }, { x: nx, y: ny }, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES);
                    if (path) {
                        this.moveTo(path);
                        this.moveInterval = 3000 + Math.random() * 4000; // Reset interval
                        break;
                    }
                }
                tries++;
            }
        }
    }

    showMessage() {
        // Remove existing message
        this.hideMessage();

        // Face forward and stop moving
        this.direction = 'front';
        this.isShowingMessage = true;
        this.hasSpokenTo = true;
        this.updatePosition();

        // Check if this is Joshua and player has a badge to deliver
        let messageToShow = this.message;
        if (this.name.toLowerCase() === 'joshua' && badgeSystem.hasBadge()) {
            const badgeMessage = badgeSystem.deliverBadge();
            if (badgeMessage) {
                messageToShow = badgeMessage;
                // Update player's badge count and display
                if (window.player) {
                    window.player.inventory.badges--;
                    window.player.updateInventoryDisplay();
                }
            }
        }

        // Create chatbox container
        this.messageContainer = document.createElement('div');
        this.messageContainer.className = 'chatbox-container';

        // Position the chatbox above the NPC
        // Screen position = grid position + container offset
        const npcScreenX = (window.MAP_OFFSET_X || 0) + this.x * window.TILE_SIZE + window.TILE_SIZE;
        const npcScreenY = (window.MAP_OFFSET_Y || 0) + this.y * window.TILE_SIZE - window.TILE_SIZE;
        const isLandscape = window.innerWidth > window.innerHeight;
        const chatboxHeight = isLandscape ? 310 : 192; // Match the CSS heights
        const chatboxWidth = isLandscape ? 620 : 384;

        // Calculate desired top position (above NPC)
        let topPos = npcScreenY - chatboxHeight;

        // Clamp to viewport bounds
        const minTop = 10; // Small margin from top
        const maxTop = window.innerHeight - chatboxHeight - 10;

        // If chatbox would go off top, position it below the NPC instead
        if (topPos < minTop) {
            topPos = npcScreenY + window.TILE_SIZE * 2 + 10; // Below the NPC
        }

        // Ensure it doesn't go off bottom either
        topPos = Math.min(topPos, maxTop);

        // Clamp horizontal position
        let leftPos = npcScreenX;
        const halfWidth = chatboxWidth / 2;
        leftPos = Math.max(halfWidth + 10, Math.min(leftPos, window.innerWidth - halfWidth - 10));

        this.messageContainer.style.left = `${leftPos}px`;
        this.messageContainer.style.top = `${topPos}px`;
        this.messageContainer.style.transform = 'translateX(-50%)'; // Center horizontally

        // Create chatbox
        const chatbox = document.createElement('div');
        chatbox.className = 'chatbox';

        // Create text element
        const textElement = document.createElement('div');
        textElement.className = 'chatbox-text';
        textElement.innerHTML = messageToShow;

        // Assemble the chatbox
        chatbox.appendChild(textElement);
        this.messageContainer.appendChild(chatbox);
        document.body.appendChild(this.messageContainer);

        // Auto-hide after 10 seconds
        this.messageTimeout = setTimeout(() => {
            this.hideMessage();
        }, 10000);
    }

    hideMessage() {
        if (this.messageContainer) {
            this.messageContainer.remove();
            this.messageContainer = null;
        }
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
            this.messageTimeout = null;
        }
        this.isShowingMessage = false;
    }

    isNearPlayer(playerX, playerY) {
        const dx = Math.abs(this.x - playerX);
        const dy = Math.abs(this.y - playerY);
        return dx <= 1 && dy <= 1;
    }

    isClicked(x, y) {
        // Check if clicking on the NPC or any surrounding tile
        const dx = Math.abs(this.x - x);
        const dy = Math.abs(this.y - y);
        return dx <= 1 && dy <= 1;
    }
}

// NPC definitions
export const npcDefinitions = [
    {
        name: 'joshua',
        message: 'Hello! Welcome to my farm. The chickens are doing well today!'
    }
]; 