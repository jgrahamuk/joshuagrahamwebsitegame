import { tileTypes, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, map, removeResource, getResourceAt } from './map.js';
import { findPath } from './movement.js';
import { getSpriteUrl } from './spriteCache.js';

export class Player {
    constructor(svg, startX, startY) {
        this.x = startX;
        this.y = startY;
        this.direction = 'front';
        this.element = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        this.svg = svg;
        this.svg.appendChild(this.element);
        this.targetResource = null; // Track if we're moving to gather a resource
        this.updatePosition();
    }
    updatePosition() {
        let sprite = `character-${this.direction}.png`;
        this.element.setAttribute('href', getSpriteUrl(sprite));
        this.element.setAttribute('x', this.x * window.TILE_SIZE);
        this.element.setAttribute('y', this.y * window.TILE_SIZE);
        this.element.setAttribute('width', window.TILE_SIZE * 2);
        this.element.setAttribute('height', window.TILE_SIZE * 2);
    }
    async moveTo(path, targetResource = null, interactionData = null) {
        this.targetResource = targetResource; // Set the target resource if provided
        this.interactionData = interactionData; // Set interaction data if provided
        let last = { x: this.x, y: this.y };
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
            // Remove the visual element from SVG
            this.removeResourceElement(resourcePos);
        }
    }

    removeResourceElement(resourcePos) {
        const resourceX = resourcePos.x * window.TILE_SIZE;
        const resourceY = resourcePos.y * window.TILE_SIZE;
        const resourceElements = this.svg.querySelectorAll('image');

        resourceElements.forEach(element => {
            const x = parseFloat(element.getAttribute('x'));
            const y = parseFloat(element.getAttribute('y'));
            const width = parseFloat(element.getAttribute('width'));
            const height = parseFloat(element.getAttribute('height'));

            // Check if this element is the resource at the target position
            if (x === resourceX && y === resourceY && width === window.TILE_SIZE && height === window.TILE_SIZE) {
                const href = element.getAttribute('href');
                if (href && (href.includes('tree.png') || href.includes('stone.png') || href.includes('flower.png'))) {
                    element.remove();
                }
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
} 