// js/spriteCache.js
const spriteNames = [
    'character-front.png', 'character-back.png', 'character-left.png', 'character-right.png',
    'character-left-walk.png', 'character-right-walk.png',
    'chicken-front.png', 'chicken-back.png', 'chicken-left.png', 'chicken-right.png',
    'chicken-peck-right.png', 'chicken-peck-left.png',
    'tile-dirt.png', 'tile-grass.png', 'tile-water.png',
    'tree.png', 'stone.png', 'flower.png', 'egg.png',
    'farmhouse.png',
    'chicken-coop.png',
    'sign-joshuagraham.png',
    'joshua-front.png', 'joshua-back.png', 'joshua-left.png', 'joshua-right.png',
    'chatbox.png'
];

const cache = {};

export function preloadSprites(basePath = 'resources/images/') {
    return Promise.all(spriteNames.map(name => {
        return new Promise(resolve => {
            const img = new window.Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                cache[name] = canvas.toDataURL('image/png');
                resolve();
            };
            img.src = basePath + name;
        });
    }));
}

export function getSpriteUrl(name) {
    if (!cache[name]) {
        console.warn('Sprite not cached:', name);
    }
    return cache[name] || '';
} 