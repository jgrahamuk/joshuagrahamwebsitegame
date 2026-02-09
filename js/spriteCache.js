// js/spriteCache.js
const spriteNames = [
    'character-front.gif', 'character-back.gif', 'character-left.gif', 'character-right.gif',
    'character-left-walk.gif', 'character-right-walk.gif',
    'chicken-front.gif', 'chicken-back.gif', 'chicken-left.gif', 'chicken-right.gif',
    'chicken-peck-right.gif', 'chicken-peck-left.gif',
    'cockerel-front.gif', 'cockerel-back.gif', 'cockerel-left.gif', 'cockerel-right.gif',
    'cockerel-peck-right.gif', 'cockerel-peck-left.gif',
    'tile-dirt.gif', 'tile-grass.gif', 'tile-sand.gif', 'tile-water.gif', 'bridge-horizontal.gif', 'bridge-vertical.gif',
    'tile-grass-edge.gif', 'tile-grass-corner.gif', 'tile-grass-corner-inside.gif',
    'tree.gif', 'bush.gif', 'pine-tree.gif', 'stone.gif', 'flower.gif', 'flower-rose.gif', 'flower-forgetmenot.gif', 'flower-tulip.gif', 'flower-bluebell.gif', 'egg.gif', 'badge.gif',
    'farmhouse.gif',
    'chicken-coop.gif',
    'sign-joshuagraham.gif',
    'joshua-front.gif', 'joshua-back.gif', 'joshua-left.gif', 'joshua-right.gif',
    'chatbox.gif',
    'chick-front.gif', 'chick-back.gif', 'chick-left.gif', 'chick-right.gif',
    'arrow.gif',
    'portal-purple.gif',
];

const cache = {};
const canvasCache = {};

// Names that should keep their raw URL (e.g. animated GIFs that lose animation when drawn to canvas)
const rawUrlNames = new Set(['portal-purple.gif']);

export function preloadSprites(basePath = 'resources/images/') {
    return Promise.all(spriteNames.map(name => {
        return new Promise(resolve => {
            const img = new window.Image();
            img.onload = () => {
                if (rawUrlNames.has(name)) {
                    cache[name] = basePath + name;
                } else {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    canvasCache[name] = canvas;
                    cache[name] = canvas.toDataURL('image/png');
                }
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

export function getSpriteCanvas(name) {
    return canvasCache[name] || null;
} 