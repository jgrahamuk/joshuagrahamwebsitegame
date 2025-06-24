import { tileTypes, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, map } from './map.js';
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

            // Check for resource gathering
            this.gatherResource();

            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    gatherResource() {
        const tiles = map[this.y][this.x];
        const topTile = tiles[tiles.length - 1];

        if (topTile && topTile.resource) {
            // Remove the resource from the map
            tiles.pop();

            // Redraw the map to reflect the change
            if (window.drawMap) {
                window.drawMap();
            }

            // Respawn the resource after 30 seconds
            setTimeout(() => {
                tiles.push(topTile);
                if (window.drawMap) {
                    window.drawMap();
                }
            }, 30000);
        }
    }
} 