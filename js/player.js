import { tileTypes, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES } from './map.js';
import { findPath } from './movement.js';

export class Player {
    constructor(svg, startX, startY) {
        this.x = startX;
        this.y = startY;
        this.direction = 'front';
        this.element = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        this.svg = svg;
        this.svg.appendChild(this.element);
        this.updatePosition();
    }
    updatePosition() {
        let sprite = `resources/images/character-${this.direction}.png`;
        this.element.setAttribute('href', sprite);
        this.element.setAttribute('x', this.x * window.TILE_SIZE);
        this.element.setAttribute('y', this.y * window.TILE_SIZE);
        this.element.setAttribute('width', window.TILE_SIZE);
        this.element.setAttribute('height', window.TILE_SIZE);
    }
    async moveTo(path) {
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
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
} 