// Generic collectables system
// Any resource can be marked as collectable with custom text

class CollectablesSystem {
    constructor() {
        // Map of "x,y" -> { text: string }
        this.collectables = new Map();
    }

    // Load collectables from map data
    loadFromMapData(collectablesData) {
        this.collectables.clear();
        if (collectablesData && Array.isArray(collectablesData)) {
            collectablesData.forEach(item => {
                const key = `${item.x},${item.y}`;
                this.collectables.set(key, { text: item.text });
            });
        }
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

    // Show collection message popup
    showCollectionMessage(text) {
        // Create chatbox container
        const container = document.createElement('div');
        container.className = 'chatbox-container collection-message';
        container.style.cssText = `
            position: fixed;
            left: 50%;
            top: 50%;
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

        // Create close hint
        const hint = document.createElement('div');
        hint.style.cssText = `
            text-align: center;
            margin-top: 12px;
            font-size: 0.85rem;
            color: #888;
        `;
        hint.textContent = 'Click anywhere to close';

        // Assemble
        chatbox.appendChild(textElement);
        chatbox.appendChild(hint);
        container.appendChild(chatbox);
        document.body.appendChild(container);

        // Add backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'collection-message-backdrop';
        backdrop.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1400;
        `;
        document.body.appendChild(backdrop);

        // Close on click
        const close = () => {
            container.remove();
            backdrop.remove();
        };

        backdrop.addEventListener('click', close);
        container.addEventListener('click', close);
    }
}

export const collectablesSystem = new CollectablesSystem();
