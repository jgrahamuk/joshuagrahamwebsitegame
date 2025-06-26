import { tileTypes, getTile, randomGrassOrDirt, MAP_WIDTH_TILES, MAP_HEIGHT_TILES } from './map.js';
import { findPath } from './movement.js';
import { getSpriteUrl } from './spriteCache.js';
import { badgeSystem } from './badgeSystem.js';

export class NPC {
    constructor(svg, name, message, startX, startY) {
        this.name = name;
        this.message = message;

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
        this.messageElement = null;
        this.messageTextElement = null;
        this.messageTimeout = null;
        this.isShowingMessage = false;

        this.updatePosition();
        console.log(`NPC ${this.name} positioned at (${this.x}, ${this.y})`);
    }

    updatePosition() {
        let sprite = `${this.name.toLowerCase()}-${this.direction}.gif`;
        this.element.setAttribute('href', getSpriteUrl(sprite));
        this.element.setAttribute('x', (window.MAP_OFFSET_X || 0) + this.x * window.TILE_SIZE);
        this.element.setAttribute('y', (window.MAP_OFFSET_Y || 0) + this.y * window.TILE_SIZE);
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

        // Create chatbox background
        this.messageElement = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        this.messageElement.setAttribute('href', getSpriteUrl('chatbox.gif'));
        this.messageElement.setAttribute('x', (window.MAP_OFFSET_X || 0) + (this.x - 10) * window.TILE_SIZE);
        this.messageElement.setAttribute('y', (window.MAP_OFFSET_Y || 0) + (this.y - 12) * window.TILE_SIZE);
        this.messageElement.setAttribute('width', window.TILE_SIZE * 24);
        this.messageElement.setAttribute('height', window.TILE_SIZE * 12);
        this.messageElement.classList.add('npc-chatbox');
        this.messageElement.style.imageRendering = 'pixelated';

        // Create message text with wrapping
        this.messageTextElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        this.messageTextElement.setAttribute('x', (window.MAP_OFFSET_X || 0) + (this.x - 2) * window.TILE_SIZE);
        this.messageTextElement.setAttribute('y', (window.MAP_OFFSET_Y || 0) + (this.y + 8) * window.TILE_SIZE);
        this.messageTextElement.classList.add('npc-chatbox-text');

        // Wrap text to fit chatbox width with padding
        const padding = window.TILE_SIZE * 0.5; // More padding
        const maxWidth = window.TILE_SIZE * 16; // Chatbox width minus padding
        const words = messageToShow.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine + (currentLine ? ' ' : '') + word;
            // Rough estimate: each character is about 8px wide
            const estimatedWidth = testLine.length * 8;
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

        // Create multiple text elements for each line
        this.messageTextElements = [];
        const lineHeight = window.TILE_SIZE * 0.7; // Line spacing
        const startY = (window.MAP_OFFSET_Y || 0) + (this.y - 10.4) * window.TILE_SIZE + padding; // Start from top of chatbox with padding

        // Append chatbox first
        this.svg.appendChild(this.messageElement);

        lines.forEach((line, index) => {
            const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textElement.setAttribute('x', (window.MAP_OFFSET_X || 0) + (this.x + 2) * window.TILE_SIZE);
            textElement.setAttribute('y', startY + index * lineHeight);
            textElement.classList.add('npc-chatbox-text');
            textElement.textContent = line;
            this.svg.appendChild(textElement);
            this.messageTextElements.push(textElement);
        });

        // Auto-hide after 5 seconds
        this.messageTimeout = setTimeout(() => {
            this.hideMessage();
        }, 10000);
    }

    hideMessage() {
        if (this.messageElement && this.svg.contains(this.messageElement)) {
            this.svg.removeChild(this.messageElement);
            this.messageElement = null;
        }
        if (this.messageTextElements) {
            this.messageTextElements.forEach(element => {
                if (this.svg.contains(element)) {
                    this.svg.removeChild(element);
                }
            });
            this.messageTextElements = null;
        }
        if (this.messageTextElement && this.svg.contains(this.messageTextElement)) {
            this.svg.removeChild(this.messageTextElement);
            this.messageTextElement = null;
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