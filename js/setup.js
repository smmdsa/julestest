// --- Setup and Configuration Module ---

// Canvas and context setup (global for access by other modules)
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
window.canvas = canvas;
window.ctx = ctx;

// Screen dimensions and scaling (global for access by other modules)
let screenWidth, screenHeight, uiScale;
window.screenWidth = screenWidth;
window.screenHeight = screenHeight;
window.uiScale = uiScale;

// Texture constants and storage (global for access by other modules)
const textureWidth = 64;
const textureHeight = 64;
const textures = {};
window.textureWidth = textureWidth;
window.textureHeight = textureHeight;
window.textures = textures;

// Key tracking for input (global for access by other modules)
const keys = {};
window.keys = keys;

/**
 * Initialize canvas dimensions and scaling
 */
function initializeCanvas() {
    // Calculate canvas size to fill 90% of viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const targetWidth = Math.floor(viewportWidth * 0.9);
    const targetHeight = Math.floor(viewportHeight * 0.9);

    // Maintain 16:10 aspect ratio (like original 640x400)
    const aspectRatio = 16 / 10;

    if (targetWidth / targetHeight > aspectRatio) {
        // Height is the limiting factor
        screenHeight = targetHeight;
        screenWidth = Math.floor(screenHeight * aspectRatio);
    } else {
        // Width is the limiting factor
        screenWidth = targetWidth;
        screenHeight = Math.floor(screenWidth / aspectRatio);
    }

    // Set canvas dimensions
    canvas.width = screenWidth;
    canvas.height = screenHeight;
    canvas.style.width = screenWidth + 'px';
    canvas.style.height = screenHeight + 'px';

    // UI scaling factor based on canvas size
    uiScale = screenWidth / 640;
    
    // Update global references
    window.screenWidth = screenWidth;
    window.screenHeight = screenHeight;
    window.uiScale = uiScale;
}

/**
 * Generate brick texture for walls
 */
function generateBrickTexture() {
    const textureCanvas = document.createElement('canvas');
    const textureCtx = textureCanvas.getContext('2d');
    textureCanvas.width = textureWidth;
    textureCanvas.height = textureHeight;

    // Base brick color
    textureCtx.fillStyle = '#8B4513'; // SaddleBrown
    textureCtx.fillRect(0, 0, textureWidth, textureHeight);

    // Mortar
    textureCtx.strokeStyle = '#A0522D'; // Sienna
    textureCtx.lineWidth = 1;

    for (let y = 0; y < textureHeight; y += 16) {
        textureCtx.beginPath();
        textureCtx.moveTo(0, y);
        textureCtx.lineTo(textureWidth, y);
        textureCtx.stroke();
        for (let x = 0; x < textureWidth; x += 32) {
            let offset = (y / 16) % 2 === 0 ? 0 : 16;
            textureCtx.beginPath();
            textureCtx.moveTo(x + offset, y);
            textureCtx.lineTo(x + offset, y + 16);
            textureCtx.stroke();
        }
    }
    return textureCtx.getImageData(0, 0, textureWidth, textureHeight);
}

/**
 * Generate dungeon floor texture
 */
function generateDungeonFloorTexture() {
    const textureCanvas = document.createElement('canvas');
    const textureCtx = textureCanvas.getContext('2d');
    textureCanvas.width = textureWidth;
    textureCanvas.height = textureHeight;

    // Base stone color
    textureCtx.fillStyle = '#696969'; // DimGray
    textureCtx.fillRect(0, 0, textureWidth, textureHeight);

    // Cracks and details
    textureCtx.strokeStyle = '#555555';
    textureCtx.lineWidth = 1.5;
    textureCtx.beginPath();
    for (let i = 0; i < 40; i++) {
        const x1 = Math.random() * textureWidth;
        const y1 = Math.random() * textureHeight;
        const x2 = x1 + (Math.random() - 0.5) * 20;
        const y2 = y1 + (Math.random() - 0.5) * 20;
        textureCtx.moveTo(x1, y1);
        textureCtx.lineTo(x2, y2);
    }
    textureCtx.stroke();

    // Highlights and shadows
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * textureWidth;
        const y = Math.random() * textureHeight;
        const color = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        textureCtx.fillStyle = color;
        textureCtx.fillRect(x, y, 2, 2);
    }

    return textureCtx.getImageData(0, 0, textureWidth, textureHeight);
}

/**
 * Generate all game textures
 */
function generateTextures() {
    textures.wall = generateBrickTexture();
    textures.floor = generateDungeonFloorTexture();
    textures.ceiling = generateDungeonFloorTexture(); // Using floor for ceiling for now
}

/**
 * Mouse rotation handler
 */
function updateRotation(e) {
    const rotAmount = e.movementX * 0.002;
    const p = gameState.player;
    const oldDirX = p.dirX;
    p.dirX = p.dirX * Math.cos(-rotAmount) - p.dirY * Math.sin(-rotAmount);
    p.dirY = oldDirX * Math.sin(-rotAmount) + p.dirY * Math.cos(-rotAmount);
    const oldPlaneX = p.planeX;
    p.planeX = p.planeX * Math.cos(-rotAmount) - p.planeY * Math.sin(-rotAmount);
    p.planeY = oldPlaneX * Math.sin(-rotAmount) + p.planeY * Math.cos(-rotAmount);
}

/**
 * Set up input event handlers
 */
function setupInputHandlers() {
    // Key tracking
    document.addEventListener('keydown', (e) => { keys[e.code] = true; });
    document.addEventListener('keyup', (e) => { keys[e.code] = false; });

    // Pointer lock change handler
    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === canvas) document.addEventListener("mousemove", updateRotation, false);
        else document.removeEventListener("mousemove", updateRotation, false);
    }, false);
}

/**
 * Set up basic canvas click handler for shooting and pointer lock
 */
function setupCanvasClickHandler() {
    canvas.addEventListener('click', () => {
        audioManager.init(); // Initialize audio on first click
        canvas.requestPointerLock();
        shoot();
    });
}