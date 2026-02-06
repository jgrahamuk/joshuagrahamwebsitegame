export class HelpOverlay {
    constructor() {
        this.isVisible = false;
        this.overlay = null;
        this.setupKeyboardShortcut();
    }

    setupKeyboardShortcut() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+H to toggle help
            if (e.ctrlKey && e.shiftKey && e.key === 'H') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    show() {
        this.isVisible = true;
        this.createOverlay();
    }

    hide() {
        this.isVisible = false;
        if (this.overlay) {
            document.body.removeChild(this.overlay);
            this.overlay = null;
        }
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.8);
            z-index: 2000;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: sans-serif;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 15px;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
        `;

        content.innerHTML = `
            <h2 style="margin-top: 0; color: #333;">Keyboard Shortcuts</h2>
            
            <h3 style="color: #666; margin-top: 20px;">Game Controls</h3>
            <ul style="line-height: 1.6;">
                <li><strong>Click</strong> - Move to location or interact with objects</li>
                <li><strong>Click on resources</strong> - Gather wood, stone, etc.</li>
                <li><strong>Click on NPCs</strong> - Talk to characters</li>
            </ul>
            
            <h3 style="color: #666; margin-top: 20px;">Map Editor</h3>
            <ul style="line-height: 1.6;">
                <li><strong>Ctrl+Shift+E</strong> - Toggle map editor toolbar</li>
                <li><strong>Click toolbar item</strong> - Select tool (delete, grass, trees, etc.)</li>
                <li><strong>Click on map</strong> - Apply selected tool to tile</li>
                <li><strong>Click item (no tool)</strong> - Add a collection message to item</li>
            </ul>
            
            <h3 style="color: #666; margin-top: 20px;">Help</h3>
            <ul style="line-height: 1.6;">
                <li><strong>Ctrl+Shift+H</strong> - Toggle this help overlay</li>
            </ul>
            
            <div style="margin-top: 30px; text-align: center;">
                <button id="close-help" style="
                    padding: 10px 20px;
                    background: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                ">Close</button>
            </div>
        `;

        this.overlay.appendChild(content);
        document.body.appendChild(this.overlay);

        // Close button functionality
        const closeButton = content.querySelector('#close-help');
        closeButton.addEventListener('click', () => {
            this.hide();
        });

        // Click outside to close
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });
    }
} 