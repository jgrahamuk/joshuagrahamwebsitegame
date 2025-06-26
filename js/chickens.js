import { tileTypes, getTile, randomGrassOrDirt, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, placeResourceAtPosition, removeResource } from './map.js';
import { findPath } from './movement.js';
import { getSpriteUrl } from './spriteCache.js';

const chickenSprites = {
    front: 'chicken-front.png',
    back: 'chicken-back.png',
    left: 'chicken-left.png',
    right: 'chicken-right.png',
    peckRight: 'chicken-peck-right.png',
    peckLeft: 'chicken-peck-left.png',
};

const cockerelSprites = {
    front: 'cockerel-front.png',
    back: 'cockerel-back.png',
    left: 'cockerel-left.png',
    right: 'cockerel-right.png',
    peckLeft: 'cockerel-peck-left.png',
    peckRight: 'cockerel-peck-right.png'
};

const chickSprites = {
    front: 'chick-front.png',
    back: 'chick-back.png',
    left: 'chick-left.png',
    right: 'chick-right.png',
};

// Track egg placement times for hatching
if (!window.eggTimers) window.eggTimers = {};
if (!window.chicks) window.chicks = [];
if (!window.cockerels) window.cockerels = [];

// Population control
const MAX_TOTAL_POPULATION = 50;

function getCurrentPopulation() {
    const numChickens = window.chickens ? window.chickens.length : 0;
    const numCockerels = window.cockerels ? window.cockerels.length : 0;
    const numChicks = window.chicks ? window.chicks.length : 0;
    const numEggs = Object.keys(window.eggTimers).length;
    return numChickens + numCockerels + numChicks + numEggs;
}

export class Chicken {
    constructor(svg, startX, startY) {
        // Check population limit before creating new chicken
        if (getCurrentPopulation() >= MAX_TOTAL_POPULATION) {
            return null;
        }

        // Use provided coordinates or get random position
        if (startX !== undefined && startY !== undefined) {
            this.x = startX;
            this.y = startY;
        } else {
            const pos = randomGrassOrDirt();
            this.x = pos.x;
            this.y = pos.y;
        }

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

        // Egg laying properties
        this.nextEggLay = Date.now() + 30000 + Math.random() * 60000; // 30-90 seconds
        this.isLayingEgg = false;
        this.eggLayStartTime = 0;
        this.eggLayDuration = 2000; // 2 seconds to lay an egg

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
        this.element.setAttribute('href', getSpriteUrl(sprite));
        this.element.setAttribute('x', (window.MAP_OFFSET_X || 0) + this.x * window.TILE_SIZE);
        this.element.setAttribute('y', (window.MAP_OFFSET_Y || 0) + this.y * window.TILE_SIZE);
        this.element.setAttribute('width', window.TILE_SIZE);
        this.element.setAttribute('height', window.TILE_SIZE);
        this.element.style.imageRendering = 'pixelated';
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
        // Egg laying logic - check this FIRST with higher priority
        if (this.isLayingEgg) {
            if (now - this.eggLayStartTime >= this.eggLayDuration) {
                // Check population limit before laying egg
                if (getCurrentPopulation() < MAX_TOTAL_POPULATION) {
                    // Finish laying egg
                    this.isLayingEgg = false;
                    this.state = 'walk';
                    this.updatePosition();

                    // Place egg on the map
                    placeResourceAtPosition(this.x, this.y, tileTypes.EGG);

                    // Debug: Check if egg was placed in map data
                    if (window.map && window.map[this.y] && window.map[this.y][this.x]) {
                        const tiles = window.map[this.y][this.x];
                        const topTile = tiles[tiles.length - 1];
                    } else {
                        console.log('Map data not available for debugging');
                    }

                    // Add egg element to SVG without full redraw
                    this.addEggToSVG(this.x, this.y);
                } else {
                    // Cancel egg laying if population limit reached
                    this.isLayingEgg = false;
                    this.state = 'walk';
                    this.updatePosition();
                }

                // Schedule next egg lay
                this.nextEggLay = now + 10000 + Math.random() * 10000; // 10-20 seconds for testing
            }
            return; // Don't do other activities while laying egg
        }

        // Check if it's time to lay an egg - HIGH PRIORITY
        if (now >= this.nextEggLay && !this.moving) {
            this.isLayingEgg = true;
            this.eggLayStartTime = now;
            this.state = 'peck'; // Use pecking animation for egg laying
            this.pecksLeft = 1; // Just one "peck" for egg laying
            this.isPeckingPose = false;
            this.nextPeckFrame = now + 100;
            this.updatePosition();
            return;
        }

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
                        this.pecksLeft = 1 + Math.floor(Math.random() * 2);
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
        if (!this.moving && now - this.lastMove > 5000 + Math.random() * 5000) { // 5-10 seconds between moves
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
    addEggToSVG(x, y) {
        const eggElement = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        eggElement.setAttribute('href', getSpriteUrl('egg.png'));
        eggElement.setAttribute('x', (window.MAP_OFFSET_X || 0) + x * window.TILE_SIZE);
        eggElement.setAttribute('y', (window.MAP_OFFSET_Y || 0) + y * window.TILE_SIZE);
        eggElement.setAttribute('width', window.TILE_SIZE);
        eggElement.setAttribute('height', window.TILE_SIZE);
        eggElement.setAttribute('data-resource', 'egg');
        eggElement.style.imageRendering = 'pixelated';
        this.svg.appendChild(eggElement);
        window.eggTimers[`${x},${y}`] = Date.now();
    }
}

export class Cockerel {
    constructor(svg, startX, startY) {
        // Check population limit before creating new cockerel
        if (getCurrentPopulation() >= MAX_TOTAL_POPULATION) {
            return null;
        }

        // Use provided coordinates or get random position
        if (startX !== undefined && startY !== undefined) {
            this.x = startX;
            this.y = startY;
        } else {
            const pos = randomGrassOrDirt();
            this.x = pos.x;
            this.y = pos.y;
        }

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
            if (this.direction === 'right') sprite = cockerelSprites.peckRight;
            else if (this.direction === 'left') sprite = cockerelSprites.peckLeft;
            else sprite = cockerelSprites[this.direction];
        } else {
            sprite = cockerelSprites[this.direction];
        }
        this.element.setAttribute('href', getSpriteUrl(sprite));
        this.element.setAttribute('x', (window.MAP_OFFSET_X || 0) + this.x * window.TILE_SIZE);
        this.element.setAttribute('y', (window.MAP_OFFSET_Y || 0) + this.y * window.TILE_SIZE);
        this.element.setAttribute('width', window.TILE_SIZE * 1.5);
        this.element.setAttribute('height', window.TILE_SIZE * 1.5);
        this.element.style.imageRendering = 'pixelated';
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
                        this.pecksLeft = 1 + Math.floor(Math.random() * 2);
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
        if (!this.moving && now - this.lastMove > 5000 + Math.random() * 5000) { // 5-10 seconds between moves
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

export class Chick {
    constructor(svg, startX, startY) {
        // Check population limit before creating new chick
        if (getCurrentPopulation() >= MAX_TOTAL_POPULATION) {
            return null;
        }

        if (startX !== undefined && startY !== undefined) {
            this.x = startX;
            this.y = startY;
        } else {
            const pos = randomGrassOrDirt();
            this.x = pos.x;
            this.y = pos.y;
        }
        this.direction = 'front';
        this.state = 'walk';
        this.lastMove = Date.now();
        this.nextFarMove = Date.now() + 30000 + Math.random() * 30000;
        this.path = [];
        this.moving = false;
        this.moveSpeed = 300;
        this.nextStepTime = 0;
        this.element = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        this.svg = svg;
        this.svg.appendChild(this.element);
        this.updatePosition();
        this.bornTime = Date.now(); // Track when the chick was created
    }
    updatePosition() {
        let sprite = chickSprites[this.direction];
        this.element.setAttribute('href', getSpriteUrl(sprite));
        this.element.setAttribute('x', (window.MAP_OFFSET_X || 0) + this.x * window.TILE_SIZE);
        this.element.setAttribute('y', (window.MAP_OFFSET_Y || 0) + this.y * window.TILE_SIZE);
        this.element.setAttribute('width', window.TILE_SIZE);
        this.element.setAttribute('height', window.TILE_SIZE);
        this.element.style.imageRendering = 'pixelated';
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
        // Mature into a chicken after 2 minutes (120000 ms)
        if (now - this.bornTime > 120000) {
            // Remove chick SVG
            if (this.element && this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
            }
            // Remove from window.chicks
            if (window.chicks) {
                const idx = window.chicks.indexOf(this);
                if (idx !== -1) window.chicks.splice(idx, 1);
            }
            // Add a new Chicken (hen) at this position only if under population limit
            if (window.chickens && getCurrentPopulation() < MAX_TOTAL_POPULATION) {
                const chicken = new Chicken(window.svg, this.x, this.y);
                if (chicken) {  // Only add if constructor succeeded
                    window.chickens.push(chicken);
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
                }
            }
            return;
        }
        // Far move
        if (now > this.nextFarMove && !this.moving) {
            const pos = randomGrassOrDirt();
            const path = findPath({ x: this.x, y: this.y }, pos, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES);
            this.moveTo(path, true);
            this.nextFarMove = now + 30000 + Math.random() * 30000;
            return;
        }
        // Move to a nearby tile if not moving
        if (!this.moving && now - this.lastMove > 5000 + Math.random() * 5000) {
            let tries = 0;
            while (tries < 10) {
                const dx = Math.floor(Math.random() * 7) - 3;
                const dy = Math.floor(Math.random() * 7) - 3;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { tries++; continue; }
                const nx = this.x + dx;
                const ny = this.y + dy;
                if (nx >= 0 && ny >= 0 && nx < MAP_WIDTH_TILES && ny < MAP_HEIGHT_TILES && (getTile(nx, ny) === tileTypes.GRASS || getTile(nx, ny) === tileTypes.DIRT)) {
                    const path = findPath({ x: this.x, y: this.y }, { x: nx, y: ny }, getTile, MAP_WIDTH_TILES, MAP_HEIGHT_TILES);
                    this.moveTo(path, false);
                    break;
                }
                tries++;
            }
        }
    }
}

// Global egg hatching tick
function hatchEggsTick() {
    const now = Date.now();
    for (const key in window.eggTimers) {
        if (window.eggTimers.hasOwnProperty(key)) {
            const [x, y] = key.split(',').map(Number);
            if (now - window.eggTimers[key] > 60000) { // 60 seconds
                // Remove egg from map and SVG
                removeResource(x, y);
                // Remove egg SVG element
                const svg = window.svg;
                const eggElements = svg.querySelectorAll('image[data-resource="egg"]');
                eggElements.forEach(el => {
                    const ex = parseInt(el.getAttribute('x'));
                    const ey = parseInt(el.getAttribute('y'));
                    if (Math.round(ex / window.TILE_SIZE) === x && Math.round(ey / window.TILE_SIZE) === y) {
                        svg.removeChild(el);
                    }
                });

                // Only spawn a chick if under population limit
                if (getCurrentPopulation() < MAX_TOTAL_POPULATION) {
                    const chick = new Chick(window.svg, x, y);
                    if (chick) {  // Only add if constructor succeeded
                        window.chicks.push(chick);
                    }
                }

                // Remove timer
                delete window.eggTimers[key];
            }
        }
    }
}
setInterval(hatchEggsTick, 1000); 