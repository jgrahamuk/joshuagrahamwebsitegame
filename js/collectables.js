// Generic collectables system
// Any resource can be marked as collectable with custom text

class CollectablesSystem {
    constructor() {
        // Map of "x,y" -> { text: string }
        this.collectables = new Map();
        // Set of collected position keys
        this.collected = new Set();
        // Total count when map was loaded (for display)
        this.totalCount = 0;
    }

    // Load collectables from map data
    loadFromMapData(collectablesData) {
        this.collectables.clear();
        this.collected.clear();
        if (collectablesData && Array.isArray(collectablesData)) {
            collectablesData.forEach(item => {
                const key = `${item.x},${item.y}`;
                this.collectables.set(key, { text: item.text });
            });
        }
        this.totalCount = this.collectables.size;
    }

    // Reset collection state (for new game)
    reset() {
        this.collected.clear();
    }

    // Export collectables for saving
    toMapData() {
        const data = [];
        this.collectables.forEach((value, key) => {
            const [x, y] = key.split(',').map(Number);
            data.push({ x, y, text: value.text });
        });
        return data;
    }

    // Set collectable data for a position
    setCollectable(x, y, text) {
        const key = `${x},${y}`;
        if (text && text.trim()) {
            this.collectables.set(key, { text: text.trim() });
        } else {
            this.collectables.delete(key);
        }
    }

    // Get collectable data for a position
    getCollectable(x, y) {
        const key = `${x},${y}`;
        return this.collectables.get(key) || null;
    }

    // Check if position has collectable data
    hasCollectable(x, y) {
        const key = `${x},${y}`;
        return this.collectables.has(key);
    }

    // Remove collectable at position
    removeCollectable(x, y) {
        const key = `${x},${y}`;
        this.collectables.delete(key);
    }

    // Mark a collectable as collected
    markCollected(x, y) {
        const key = `${x},${y}`;
        if (this.collectables.has(key)) {
            this.collected.add(key);
        }
    }

    // Get count of collected items
    getCollectedCount() {
        return this.collected.size;
    }

    // Get total count of collectables
    getTotalCount() {
        return this.totalCount;
    }

    // Get display text for UI (e.g., "0/3")
    getDisplayText() {
        if (this.totalCount === 0) {
            return '0';
        }
        const collected = this.collected.size;
        if (collected >= this.totalCount) {
            return `${this.totalCount}/${this.totalCount} ✓`;
        }
        return `${collected}/${this.totalCount}`;
    }

    // Show collection message popup (styled like intro)
    showCollectionMessage(text) {
        const svg = window.svg;
        if (!svg) return;

        // Create blur overlay on SVG
        const blurOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        blurOverlay.setAttribute('x', 0);
        blurOverlay.setAttribute('y', 0);
        blurOverlay.setAttribute('width', window.innerWidth);
        blurOverlay.setAttribute('height', window.innerHeight);
        blurOverlay.setAttribute('fill', 'rgba(0, 0, 0, 0.3)');
        blurOverlay.setAttribute('class', 'collection-blur-overlay');

        // Create and apply blur filter if not exists
        let filter = svg.querySelector('#collection-blur-filter');
        if (!filter) {
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
            filter.setAttribute('id', 'collection-blur-filter');
            const gaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
            gaussianBlur.setAttribute('stdDeviation', '4');
            filter.appendChild(gaussianBlur);
            defs.appendChild(filter);
            svg.appendChild(defs);
        }

        blurOverlay.style.filter = 'url(#collection-blur-filter)';
        svg.appendChild(blurOverlay);

        // Create chatbox container
        const container = document.createElement('div');
        container.className = 'chatbox-container collection-message';
        container.style.cssText = `
            position: fixed;
            left: 50%;
            top: 40%;
            transform: translate(-50%, -50%);
            z-index: 1500;
        `;

        // Create chatbox
        const chatbox = document.createElement('div');
        chatbox.className = 'chatbox';

        // Create text element
        const textElement = document.createElement('div');
        textElement.className = 'chatbox-text';
        textElement.innerHTML = text;

        // Assemble
        chatbox.appendChild(textElement);
        container.appendChild(chatbox);
        document.body.appendChild(container);

        // Close with fade on click anywhere
        const close = (e) => {
            e.stopPropagation();

            // Fade out blur overlay
            let opacity = 1;
            const fadeInterval = setInterval(() => {
                opacity -= 0.1;
                if (opacity <= 0) {
                    clearInterval(fadeInterval);
                    blurOverlay.remove();
                } else {
                    blurOverlay.setAttribute('fill-opacity', opacity);
                }
            }, 50);

            // Fade out chatbox
            let chatOpacity = 1;
            const chatFadeInterval = setInterval(() => {
                chatOpacity -= 0.1;
                if (chatOpacity <= 0) {
                    clearInterval(chatFadeInterval);
                    container.remove();
                } else {
                    container.style.opacity = chatOpacity;
                }
            }, 50);

            // Remove click listener
            document.removeEventListener('click', close);
            svg.removeEventListener('click', close);
        };

        // Add click handlers after a brief delay to prevent immediate close
        setTimeout(() => {
            document.addEventListener('click', close, { once: true });
            svg.addEventListener('click', close, { once: true });
        }, 100);
    }
}

export const collectablesSystem = new CollectablesSystem();
