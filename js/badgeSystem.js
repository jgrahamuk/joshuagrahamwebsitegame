import { tileTypes, placeResourceAtPosition, removeResource } from './map.js';
import { randomGrassOrDirt } from './map.js';
import { getSpriteUrl } from './spriteCache.js';

// Badge definitions with messages
export const badges = [
    {
        id: 1,
        message: "Hey! That's my IBM badge. I've been looking for it everywhere! That was one of my first jobs back in 2000! That's not the one I was looking for, though."
    },
    {
        id: 2,
        message: "Ahh! CCQ. I worked there for 13 years. I helped a lot of startups there! I managed several independent development teams (up to 20 devs in total), both in-house and client-side. During this time I was the principal engineer on 30+ software products."
    },
    {
        id: 3,
        message: "Hey! Brickflow! I helped them build their prop-tech platform! I was responsible for designing and building the initial platform as well as recruiting, training and managing developers to make it the go-to place for property development loan sourcing."
    },
    {
        id: 4,
        message: "Federal-Mogul. That was the last place I worked in America!"
    },
    {
        id: 5,
        message: "Aha! Optimise! That's the one! I should keep track of this one. I'm the Director of Software Engineering. At Optimise Guernsey, I've been responsible for building and leading a software engineering team of 5-10. We've been an integral part of a large-scale government project and I've successfully led not only our team, but a number of initiatives with other vendors."
    }
];

class BadgeSystem {
    constructor() {
        this.currentBadgeIndex = 0;
        this.currentBadgePosition = null;
        this.playerHasBadge = false;
        this.completedBadges = new Set();
    }

    // Place the next badge on the map
    placeNextBadge() {
        if (this.currentBadgeIndex >= badges.length) {
            console.log('All badges have been collected!');
            // Clear the current badge position since no more badges
            this.currentBadgePosition = null;
            return;
        }

        // Remove current badge if it exists
        if (this.currentBadgePosition) {
            removeResource(this.currentBadgePosition.x, this.currentBadgePosition.y);
            // Remove the visual element from SVG
            this.removeBadgeElement(this.currentBadgePosition);
        }

        // Find a new position for the badge
        const position = randomGrassOrDirt();
        placeResourceAtPosition(position.x, position.y, tileTypes.BADGE);
        this.currentBadgePosition = position;

        // Add the badge element directly to SVG
        this.addBadgeElement(position);

        console.log(`Badge ${this.currentBadgeIndex + 1} placed at (${position.x}, ${position.y})`);
    }

    // Add badge element directly to SVG
    addBadgeElement(position) {
        if (!window.svg) return;

        const offsetX = window.MAP_OFFSET_X || 0;
        const offsetY = window.MAP_OFFSET_Y || 0;

        const badgeElement = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        badgeElement.setAttribute('href', getSpriteUrl('badge.gif'));
        badgeElement.setAttribute('x', offsetX + position.x * window.TILE_SIZE);
        badgeElement.setAttribute('y', offsetY + position.y * window.TILE_SIZE);
        badgeElement.setAttribute('width', window.TILE_SIZE);
        badgeElement.setAttribute('height', window.TILE_SIZE);
        badgeElement.setAttribute('data-resource', 'badge');

        window.svg.appendChild(badgeElement);
    }

    // Remove badge element from SVG
    removeBadgeElement(position) {
        if (!window.svg) return;

        const offsetX = window.MAP_OFFSET_X || 0;
        const offsetY = window.MAP_OFFSET_Y || 0;
        const badgeX = offsetX + position.x * window.TILE_SIZE;
        const badgeY = offsetY + position.y * window.TILE_SIZE;

        const badgeElements = window.svg.querySelectorAll('image[data-resource="badge"]');
        badgeElements.forEach(element => {
            const x = parseFloat(element.getAttribute('x'));
            const y = parseFloat(element.getAttribute('y'));
            const width = parseFloat(element.getAttribute('width'));
            const height = parseFloat(element.getAttribute('height'));

            if (x === badgeX && y === badgeY && width === window.TILE_SIZE && height === window.TILE_SIZE) {
                element.remove();
            }
        });
    }

    // Player collects a badge
    collectBadge() {
        if (this.playerHasBadge) {
            console.log('Player already has a badge');
            return false;
        }

        if (this.currentBadgeIndex >= badges.length) {
            console.log('No more badges to collect');
            return false;
        }

        this.playerHasBadge = true;
        console.log(`Player collected badge ${this.currentBadgeIndex + 1}`);
        return true;
    }

    // Handle badge collection and remove visual element
    handleBadgeCollection(position) {
        if (this.collectBadge()) {
            // Remove the visual element from SVG
            this.removeBadgeElement(position);
            return true;
        }
        return false;
    }

    // Player delivers badge to Joshua
    deliverBadge() {
        if (!this.playerHasBadge) {
            console.log('Player has no badge to deliver');
            return null;
        }

        const badge = badges[this.currentBadgeIndex];
        this.completedBadges.add(badge.id);
        this.playerHasBadge = false;
        this.currentBadgeIndex++;

        console.log(`Badge ${badge.id} delivered to Joshua`);

        // Place the next badge immediately
        this.placeNextBadge();

        return badge.message;
    }

    // Get current badge message
    getCurrentBadgeMessage() {
        if (this.currentBadgeIndex >= badges.length) {
            return null;
        }
        return badges[this.currentBadgeIndex].message;
    }

    // Check if player has a badge
    hasBadge() {
        return this.playerHasBadge;
    }

    // Get completion status
    getCompletionStatus() {
        return {
            completed: this.completedBadges.size,
            total: badges.length,
            currentBadgeIndex: this.currentBadgeIndex
        };
    }

    // Get display text for badge counter
    getBadgeDisplayText() {
        const status = this.getCompletionStatus();
        if (status.completed >= status.total) {
            return `${status.total}/${status.total} ✓`;
        }
        return `${status.completed}/${status.total}`;
    }

    // Initialize the badge system
    initialize() {
        this.placeNextBadge();
    }
}

export const badgeSystem = new BadgeSystem(); 