import { tileTypes, getTile, randomGrassOrDirt, MAP_WIDTH_TILES, MAP_HEIGHT_TILES } from './map.js';
import { findPath } from './movement.js';

const chickenSprites = {
    front: 'chicken-front.png',
    back: 'chicken-back.png',
    left: 'chicken-left.png',
    right: 'chicken-right.png',
    peckRight: 'chicken-peck-right.png',
    peckLeft: 'chicken-peck-left.png',
};

export class Chicken {
    constructor(svg) {
        const pos = randomGrassOrDirt();
        this.x = pos.x;
        this.y = pos.y;
        this.direction = 'front';
        this.state = 'walk';
        this.pecksLeft = 0;
        this.isPeckingPose = false;
        this.nextPeckFrame = 0;
        this.lastMove = Date.now();
        this.nextFarMove = Date.now() + 30000 + Math.random() * 30000;
        this.path = [];
        this.moving = false;
        this.moveSpeed = 300; // ms per tile (default slow)
        this.nextStepTime = 0;
        this.element = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        this.svg = svg;
        this.svg.appendChild(this.element);
        this.updatePosition();
    }
    updatePosition() {
        let sprite;
        if (this.state === 'peck' && this.isPeckingPose) {
            if (this.direction === 'right') sprite = chickenSprites.peckRight;
            else if (this.direction === 'left') sprite = chickenSprites.peckLeft;
            else sprite = chickenSprites[this.direction];
        } else {
            sprite = chickenSprites[this.direction];
        }
        this.element.setAttribute('href', `resources/images/${sprite}`);
        this.element.setAttribute('x', this.x * window.TILE_SIZE);
        this.element.setAttribute('y', this.y * window.TILE_SIZE);
        this.element.setAttribute('width', window.TILE_SIZE);
        this.element.setAttribute('height', window.TILE_SIZE);
    }
    moveTo(path, isRun = false) {
        if (path && path.length > 1) {
            this.path = path.slice(1);
            this.moving = true;
            this.moveSpeed = isRun ? 70 + Math.floor(Math.random() * 30) : 300 + Math.floor(Math.random() * 60);
            this.nextStepTime = Date.now();
        }
    }
    tick(now) {
        // Pecking animation
        if (this.state === 'peck') {
            if (now >= this.nextPeckFrame) {
                if (this.pecksLeft > 0) {
                    this.isPeckingPose = !this.isPeckingPose;
                    this.updatePosition();
                    this.nextPeckFrame = now + 150 + Math.floor(Math.random() * 100);
                    if (!this.isPeckingPose) this.pecksLeft--;
                } else {
                    this.state = 'walk';
                    this.isPeckingPose = false;
                    this.updatePosition();
                }
            }
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
                    if (this.direction === 'right' || this.direction === 'left') {
                        this.state = 'peck';
                        this.pecksLeft = 3 + Math.floor(Math.random() * 2);
                        this.isPeckingPose = false;
                        this.nextPeckFrame = now + 100;
                        this.updatePosition();
                        return;
                    }
                }
            }
            return;
        }
        // Far move
        if (now > this.nextFarMove && !this.moving && this.state !== 'peck') {
            const pos = randomGrassOrDirt();
            const path = findPath({ x: this.x, y: this.y }, pos, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES);
            this.moveTo(path, true); // running
            this.nextFarMove = now + 30000 + Math.random() * 30000;
            return;
        }
        // Move to a nearby tile if not moving
        if (!this.moving && now - this.lastMove > 1000 + Math.random() * 2000) {
            let tries = 0;
            while (tries < 10) {
                const dx = Math.floor(Math.random() * 7) - 3;
                const dy = Math.floor(Math.random() * 7) - 3;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { tries++; continue; }
                const nx = this.x + dx;
                const ny = this.y + dy;
                if (nx >= 0 && ny >= 0 && nx < MAP_WIDTH_TILES && ny < MAP_HEIGHT_TILES && (getTile(nx, ny) === tileTypes.GRASS || getTile(nx, ny) === tileTypes.DIRT)) {
                    const path = findPath({ x: this.x, y: this.y }, { x: nx, y: ny }, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES);
                    this.moveTo(path, false); // normal walk
                    break;
                }
                tries++;
            }
        }
    }
} 