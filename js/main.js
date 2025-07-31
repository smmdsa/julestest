// --- Setup and Configuration ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const loadingScreen = document.getElementById('loading-screen');

const screenWidth = 640;
const screenHeight = 400;
canvas.width = screenWidth;
canvas.height = screenHeight;

// --- Game Constants ---
const MAX_HEALTH = 100;
const MAX_SHIELD = 100;
const CLIP_SIZE = 15;
const MAX_AMMO_CARRY = 50;

const ENEMY_TYPES = {
    'grunt':    { health: 100, damage: 10, color: '#00ff00', scale: 1.0, aspectRatio: 0.8, score: 100, attackCooldown: 120 },
    'sergeant': { health: 150, damage: 20, color: '#00bfff', scale: 1.1, aspectRatio: 0.8, score: 200, attackCooldown: 100 },
    'commander':{ health: 200, damage: 30, color: '#ff4500', scale: 1.2, aspectRatio: 0.8, score: 300, attackCooldown: 80 },
    'boss':     { health: 500, damage: 50, color: '#ff00ff', scale: 1.5, aspectRatio: 0.8, score: 1000, attackCooldown: 60 }
};

// --- Texture Generation ---
const textureWidth = 64;
const textureHeight = 64;
const textures = {};

function generateBrickTexture() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = textureWidth;
    canvas.height = textureHeight;

    // Base brick color
    ctx.fillStyle = '#8B4513'; // SaddleBrown
    ctx.fillRect(0, 0, textureWidth, textureHeight);

    // Mortar
    ctx.strokeStyle = '#A0522D'; // Sienna
    ctx.lineWidth = 1;

    for (let y = 0; y < textureHeight; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(textureWidth, y);
        ctx.stroke();
        for (let x = 0; x < textureWidth; x += 32) {
            let offset = (y / 16) % 2 === 0 ? 0 : 16;
            ctx.beginPath();
            ctx.moveTo(x + offset, y);
            ctx.lineTo(x + offset, y + 16);
            ctx.stroke();
        }
    }
    return ctx.getImageData(0, 0, textureWidth, textureHeight);
}


function generateDungeonFloorTexture() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = textureWidth;
    canvas.height = textureHeight;

    // Base stone color
    ctx.fillStyle = '#696969'; // DimGray
    ctx.fillRect(0, 0, textureWidth, textureHeight);

    // Cracks and details
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 40; i++) {
        const x1 = Math.random() * textureWidth;
        const y1 = Math.random() * textureHeight;
        const x2 = x1 + (Math.random() - 0.5) * 20;
        const y2 = y1 + (Math.random() - 0.5) * 20;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
    }
    ctx.stroke();

    // Highlights and shadows
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * textureWidth;
        const y = Math.random() * textureHeight;
        const color = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 2, 2);
    }

    return ctx.getImageData(0, 0, textureWidth, textureHeight);
}


textures.wall = generateBrickTexture();
textures.floor = generateDungeonFloorTexture();
textures.ceiling = generateDungeonFloorTexture(); // Using floor for ceiling for now


// --- Game State ---
let gameState = {
    currentLevel: 1,
    player: {
        x: 0, y: 0,
        dirX: -1, dirY: 0,
        planeX: 0, planeY: 0.66,
        moveSpeed: 0.05, rotSpeed: 0.03,
        health: MAX_HEALTH,
        shield: 0,
        ammo: MAX_AMMO_CARRY,
        clipAmmo: CLIP_SIZE,
        score: 0,
        isHit: 0,
        hasKey: false,
        stepTimer: 0
    },
    map: [],
    mapWidth: 25, // Must be odd
    mapHeight: 25, // Must be odd
    sprites: [],
    zBuffer: new Array(screenWidth)
};

// --- Input Handling ---
const keys = {};
document.addEventListener('keydown', (e) => { keys[e.code] = true; });
document.addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('click', () => { 
    audioManager.init(); // Initialize audio on first click
    canvas.requestPointerLock(); 
    shoot(); 
});
document.addEventListener('pointerlockchange', () => {
     if (document.pointerLockElement === canvas) document.addEventListener("mousemove", updateRotation, false);
     else document.removeEventListener("mousemove", updateRotation, false);
}, false);

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

// --- Map Generation (Randomized DFS Maze) ---
function generateMap() {
    const w = gameState.mapWidth;
    const h = gameState.mapHeight;
    const map = Array.from({ length: h }, () => Array(w).fill(1));

    function carve(cx, cy) {
        const directions = [[0, -2], [0, 2], [-2, 0], [2, 0]];
        directions.sort(() => Math.random() - 0.5);

        for (const [dx, dy] of directions) {
            const nx = cx + dx;
            const ny = cy + dy;

            if (ny >= 0 && ny < h && nx >= 0 && nx < w && map[ny][nx] === 1) {
                map[ny - dy / 2][nx - dx / 2] = 0;
                map[ny][nx] = 0;
                carve(nx, ny);
            }
        }
    }

    map[1][1] = 0;
    carve(1, 1);

    // Open up some dead ends to make it less maze-like
    let openings = (w * h) / 10;
    while(openings > 0) {
        const x = Math.floor(Math.random() * (w - 2)) + 1;
        const y = Math.floor(Math.random() * (h - 2)) + 1;
        if(map[y][x] === 1) {
            map[y][x] = 0;
            openings--;
        }
    }

    gameState.map = map;
}

// --- Level Management ---
async function generateLevel(level) {
    showLoadingScreen();
    await new Promise(resolve => setTimeout(resolve, 100)); // Allow UI to update

    gameState.currentLevel = level;
    gameState.sprites = [];
    gameState.player.hasKey = false;
    generateMap();

    const emptyTiles = [];
    for (let y = 0; y < gameState.mapHeight; y++) {
        for (let x = 0; x < gameState.mapWidth; x++) {
            if (gameState.map[y][x] === 0) emptyTiles.push({x: x + 0.5, y: y + 0.5});
        }
    }

    const placeItem = (count, type, subType) => {
        for(let i=0; i<count; i++) {
            if(emptyTiles.length === 0) return;
            const tileIndex = Math.floor(Math.random() * emptyTiles.length);
            const tile = emptyTiles.splice(tileIndex, 1)[0];
            if (type === 'enemy') {
                 gameState.sprites.push({x: tile.x, y: tile.y, type: 'enemy', subType: subType, health: ENEMY_TYPES[subType].health, state: 'idle', isHit: 0, attackTimer: 0});
            } else {
                 gameState.sprites.push({x: tile.x, y: tile.y, type: 'pickup', subType: subType});
            }
        }
    };

    // Place player
    const playerTile = emptyTiles.splice(Math.floor(Math.random() * emptyTiles.length), 1)[0];
    gameState.player.x = playerTile.x;
    gameState.player.y = playerTile.y;

    // Difficulty scaling
    placeItem(2 + level, 'enemy', 'grunt');
    placeItem(1 + Math.floor(level / 2), 'enemy', 'sergeant');
    placeItem(Math.floor(level / 3), 'enemy', 'commander');
    placeItem(1, 'enemy', 'boss'); // Always one boss

    placeItem(Math.max(1, 5 - Math.floor(level/2)), 'pickup', 'ammo');
    placeItem(Math.max(1, 4 - Math.floor(level/2)), 'pickup', 'health');
    placeItem(Math.max(1, 3 - Math.floor(level/3)), 'pickup', 'shield');

    hideLoadingScreen();
}

function showLoadingScreen() {
    loadingScreen.style.top = '0';
}
function hideLoadingScreen() {
    loadingScreen.style.top = '-100%';
}

function spawnExitDoor() {
    const emptyTiles = [];
    for (let y = 0; y < gameState.mapHeight; y++) {
        for (let x = 0; x < gameState.mapWidth; x++) {
            if (gameState.map[y][x] === 0 && Math.hypot(x - gameState.player.x, y - gameState.player.y) > 10) {
                 emptyTiles.push({x: x + 0.5, y: y + 0.5});
            }
        }
    }
    if(emptyTiles.length > 0) {
        const tile = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
        gameState.sprites.push({x: tile.x, y: tile.y, type: 'exit'});
    }
}

// --- Game Logic ---
function shoot() {
    const p = gameState.player;
    if (p.clipAmmo > 0) {
        p.clipAmmo--;
        audioManager.play('shot');
        
        // Create a visible bullet projectile
        gameState.sprites.push({
            type: 'playerBullet',
            x: p.x,
            y: p.y,
            dirX: p.dirX,
            dirY: p.dirY,
            speed: 0.2,
            damage: 50,
            color: '#FFFF00',
            lifetime: 100 // Maximum frames the bullet can exist
        });
    }
}

function reload() {
    const p = gameState.player;
    const ammoNeeded = CLIP_SIZE - p.clipAmmo;
    const ammoToMove = Math.min(ammoNeeded, p.ammo);
    p.clipAmmo += ammoToMove;
    p.ammo -= ammoToMove;
    audioManager.play('reload');
}

function playerTakeDamage(damage) {
    const p = gameState.player;
    p.isHit = 10;
    const shieldDamage = Math.min(p.shield, damage);
    p.shield -= shieldDamage;
    const healthDamage = damage - shieldDamage;
    p.health -= healthDamage;
    audioManager.play('player_damage');
    if (p.health <= 0) {
        p.health = 0;
        alert(`GAME OVER! Final Score: ${p.score} on Level ${gameState.currentLevel}`);
        document.location.reload();
    }
}

function isVisible(start, end) {
    let x0 = Math.floor(start.x), y0 = Math.floor(start.y);
    let x1 = Math.floor(end.x), y1 = Math.floor(end.y);
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, e2;
    while (true) {
        if (gameState.map[y0][x0] === 1) return false;
        if (x0 === x1 && y0 === y1) break;
        e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return true;
}

function updateState() {
    const p = gameState.player;
    const moveSpeed = p.moveSpeed;
    let isMoving = false;
    if (keys['KeyW'] || keys['ArrowUp']) {
        if (gameState.map[Math.floor(p.y)][Math.floor(p.x + p.dirX * moveSpeed)] == 0) { p.x += p.dirX * moveSpeed; isMoving = true; }
        if (gameState.map[Math.floor(p.y + p.dirY * moveSpeed)][Math.floor(p.x)] == 0) { p.y += p.dirY * moveSpeed; isMoving = true; }
    }
    if (keys['KeyS'] || keys['ArrowDown']) {
        if (gameState.map[Math.floor(p.y)][Math.floor(p.x - p.dirX * moveSpeed)] == 0) { p.x -= p.dirX * moveSpeed; isMoving = true; }
        if (gameState.map[Math.floor(p.y - p.dirY * moveSpeed)][Math.floor(p.x)] == 0) { p.y -= p.dirY * moveSpeed; isMoving = true; }
    }
    if (keys['KeyD']) {
        if (gameState.map[Math.floor(p.y)][Math.floor(p.x + p.planeX * moveSpeed)] == 0) { p.x += p.planeX * moveSpeed; isMoving = true; }
        if (gameState.map[Math.floor(p.y + p.planeY * moveSpeed)][Math.floor(p.x)] == 0) { p.y += p.planeY * moveSpeed; isMoving = true; }
    }
    if (keys['KeyA']) {
        if (gameState.map[Math.floor(p.y)][Math.floor(p.x - p.planeX * moveSpeed)] == 0) { p.x -= p.planeX * moveSpeed; isMoving = true; }
        if (gameState.map[Math.floor(p.y - p.planeY * moveSpeed)][Math.floor(p.x)] == 0) { p.y -= p.planeY * moveSpeed; isMoving = true; }
    }
    if (isMoving) {
        p.stepTimer++;
        if (p.stepTimer >= 15) { // Play step sound every 15 frames when moving
            audioManager.play('step');
            p.stepTimer = 0;
        }
    } else {
        p.stepTimer = 0;
    }
    if (keys['KeyR']) reload();

    for (let i = gameState.sprites.length - 1; i >= 0; i--) {
        const sprite = gameState.sprites[i];
        const dist = Math.hypot(p.x - sprite.x, p.y - sprite.y);

        if (dist < 0.5) {
            if (sprite.type === 'pickup') {
                let pickedUp = false;
                if (sprite.subType === 'ammo' && p.ammo < MAX_AMMO_CARRY) { p.ammo = Math.min(MAX_AMMO_CARRY, p.ammo + CLIP_SIZE); p.score += 10; gameState.sprites.splice(i, 1); pickedUp = true; }
                if (sprite.subType === 'health' && p.health < MAX_HEALTH) { p.health = Math.min(MAX_HEALTH, p.health + 25); p.score += 10; gameState.sprites.splice(i, 1); pickedUp = true; }
                if (sprite.subType === 'shield' && p.shield < MAX_SHIELD) { p.shield = Math.min(MAX_SHIELD, p.shield + 50); p.score += 10; gameState.sprites.splice(i, 1); pickedUp = true; }
                if (sprite.subType === 'key') { p.hasKey = true; p.score += 500; gameState.sprites.splice(i, 1); pickedUp = true; }
                if (pickedUp) {
                    audioManager.play('pickup');
                }
            } else if (sprite.type === 'exit' && p.hasKey) {
                generateLevel(gameState.currentLevel + 1);
                return; // Stop processing this frame
            }
        }

        if (sprite.type === 'enemy') {
            if (sprite.isHit > 0) sprite.isHit--;
            if (sprite.state === 'dead') {
                if (!sprite.deathTimer) sprite.deathTimer = 30;
                sprite.deathTimer--;
                if (sprite.deathTimer <= 0) gameState.sprites.splice(i, 1);
                continue;
            }
            const canSeePlayer = isVisible(sprite, p);
            if (canSeePlayer && dist < 10) sprite.state = 'attacking';
            else if (canSeePlayer && dist < 20) sprite.state = 'chasing';
            else sprite.state = 'idle';

            if (sprite.state === 'chasing') {
                const moveDirX = (p.x - sprite.x) / dist;
                const moveDirY = (p.y - sprite.y) / dist;
                const enemyMoveSpeed = 0.02;
                if (gameState.map[Math.floor(sprite.y)][Math.floor(sprite.x + moveDirX * enemyMoveSpeed)] == 0) sprite.x += moveDirX * enemyMoveSpeed;
                if (gameState.map[Math.floor(sprite.y + moveDirY * enemyMoveSpeed)][Math.floor(sprite.x)] == 0) sprite.y += moveDirY * enemyMoveSpeed;
            } else if (sprite.state === 'attacking') {
                sprite.attackTimer = (sprite.attackTimer || 0) + 1;
                if (sprite.attackTimer >= ENEMY_TYPES[sprite.subType].attackCooldown) {
                    sprite.attackTimer = 0;
                    const bulletDirX = (p.x - sprite.x) / dist;
                    const bulletDirY = (p.y - sprite.y) / dist;
                    gameState.sprites.push({ type: 'projectile', x: sprite.x, y: sprite.y, dirX: bulletDirX, dirY: bulletDirY, speed: 0.1, damage: ENEMY_TYPES[sprite.subType].damage, color: '#FFA500' });
                }
            }
        } else if (sprite.type === 'projectile') {
            sprite.x += sprite.dirX * sprite.speed;
            sprite.y += sprite.dirY * sprite.speed;
            if (gameState.map[Math.floor(sprite.y)][Math.floor(sprite.x)] !== 0) {
                // Create wall impact effect for enemy projectiles
                gameState.sprites.push({
                    type: 'impact',
                    x: sprite.x,
                    y: sprite.y,
                    lifetime: 15,
                    color: '#FF6600'
                });
                audioManager.play('bullet_impact');
                gameState.sprites.splice(i, 1);
            } else if (Math.hypot(p.x - sprite.x, p.y - sprite.y) < 0.5) {
                playerTakeDamage(sprite.damage);
                gameState.sprites.splice(i, 1);
            }
        } else if (sprite.type === 'playerBullet') {
            sprite.x += sprite.dirX * sprite.speed;
            sprite.y += sprite.dirY * sprite.speed;
            sprite.lifetime--;
            
            // Check wall collision
            if (gameState.map[Math.floor(sprite.y)][Math.floor(sprite.x)] !== 0 || sprite.lifetime <= 0) {
                // Create wall impact effect
                if (gameState.map[Math.floor(sprite.y)][Math.floor(sprite.x)] !== 0) {
                    gameState.sprites.push({
                        type: 'impact',
                        x: sprite.x,
                        y: sprite.y,
                        lifetime: 20,
                        color: '#FFFF00'
                    });
                    audioManager.play('bullet_impact');
                }
                gameState.sprites.splice(i, 1);
                continue;
            }
            
            // Check enemy collision
            for (let j = 0; j < gameState.sprites.length; j++) {
                const enemy = gameState.sprites[j];
                if (enemy.type === 'enemy' && enemy.state !== 'dead') {
                    const bulletDist = Math.hypot(sprite.x - enemy.x, sprite.y - enemy.y);
                    if (bulletDist < 0.3) {
                        // Hit enemy
                        enemy.health -= sprite.damage;
                        enemy.isHit = 5;
                        audioManager.play('enemy_damage');
                        
                        if (enemy.health <= 0 && enemy.state !== 'dead') {
                            enemy.state = 'dead';
                            p.score += ENEMY_TYPES[enemy.subType].score;
                            if (enemy.subType === 'boss') {
                                gameState.sprites.push({x: enemy.x, y: enemy.y, type: 'pickup', subType: 'key'});
                                spawnExitDoor();
                            }
                        }
                        
                        // Remove bullet
                        gameState.sprites.splice(i, 1);
                        break;
                    }
                }
            }
        } else if (sprite.type === 'impact') {
            sprite.lifetime--;
            if (sprite.lifetime <= 0) {
                gameState.sprites.splice(i, 1);
            }
        }
    }
    if (p.isHit > 0) p.isHit--;
}

// --- Rendering ---
function render() {
    const p = gameState.player;
    ctx.clearRect(0, 0, screenWidth, screenHeight);
    const screenImageData = ctx.createImageData(screenWidth, screenHeight);

    // --- Floor and Ceiling Texturing ---
    for (let y = 0; y < screenHeight; y++) {
        const isFloor = y > screenHeight / 2;
        const rayDirX0 = p.dirX - p.planeX;
        const rayDirY0 = p.dirY - p.planeY;
        const rayDirX1 = p.dirX + p.planeX;
        const rayDirY1 = p.dirY + p.planeY;

        const p_ = isFloor ? (y - screenHeight / 2) : (screenHeight / 2 - y);
        const posZ = 0.5 * screenHeight;
        const rowDistance = posZ / p_;

        const floorStepX = rowDistance * (rayDirX1 - rayDirX0) / screenWidth;
        const floorStepY = rowDistance * (rayDirY1 - rayDirY0) / screenWidth;

        let floorX = p.x + rowDistance * rayDirX0;
        let floorY = p.y + rowDistance * rayDirY0;

        for (let x = 0; x < screenWidth; x++) {
            const cellX = Math.floor(floorX);
            const cellY = Math.floor(floorY);

            const tx = Math.floor(textureWidth * (floorX - cellX)) & (textureWidth - 1);
            const ty = Math.floor(textureHeight * (floorY - cellY)) & (textureHeight - 1);

            floorX += floorStepX;
            floorY += floorStepY;

            const texture = isFloor ? textures.floor : textures.ceiling;
            const texIndex = (ty * textureWidth + tx) * 4;
            const screenIndex = (y * screenWidth + x) * 4;

            const shade = Math.max(0.3, 1 - rowDistance / 15); // Add distance shading

            screenImageData.data[screenIndex] = texture.data[texIndex] * shade;
            screenImageData.data[screenIndex + 1] = texture.data[texIndex + 1] * shade;
            screenImageData.data[screenIndex + 2] = texture.data[texIndex + 2] * shade;
            screenImageData.data[screenIndex + 3] = 255;
        }
    }


    for (let x = 0; x < screenWidth; x++) {
        const cameraX = 2 * x / screenWidth - 1;
        const rayDirX = p.dirX + p.planeX * cameraX;
        const rayDirY = p.dirY + p.planeY * cameraX;
        let mapX = Math.floor(p.x);
        let mapY = Math.floor(p.y);
        const deltaDistX = (rayDirX === 0) ? 1e30 : Math.abs(1 / rayDirX);
        const deltaDistY = (rayDirY === 0) ? 1e30 : Math.abs(1 / rayDirY);
        let stepX, stepY, sideDistX, sideDistY;
        let hit = 0, side;

        if (rayDirX < 0) { stepX = -1; sideDistX = (p.x - mapX) * deltaDistX; }
        else { stepX = 1; sideDistX = (mapX + 1.0 - p.x) * deltaDistX; }
        if (rayDirY < 0) { stepY = -1; sideDistY = (p.y - mapY) * deltaDistY; }
        else { stepY = 1; sideDistY = (mapY + 1.0 - p.y) * deltaDistY; }

        while (hit === 0) {
            if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX; side = 0; }
            else { sideDistY += deltaDistY; mapY += stepY; side = 1; }
            if (gameState.map[mapY][mapX] > 0) hit = 1;
        }

        const perpWallDist = (side === 0) ? (sideDistX - deltaDistX) : (sideDistY - deltaDistY);
        gameState.zBuffer[x] = perpWallDist;

        const lineHeight = Math.floor(screenHeight / perpWallDist);
        const drawStart = Math.max(0, Math.floor(-lineHeight / 2 + screenHeight / 2));
        const drawEnd = Math.min(screenHeight - 1, Math.floor(lineHeight / 2 + screenHeight / 2));

        // --- Wall Texturing ---
        let wallX; // where exactly the wall was hit
        if (side === 0) {
            wallX = p.y + perpWallDist * rayDirY;
        } else {
            wallX = p.x + perpWallDist * rayDirX;
        }
        wallX -= Math.floor(wallX);

        let texX = Math.floor(wallX * textureWidth);
        if (side === 0 && rayDirX > 0) texX = textureWidth - texX - 1;
        if (side === 1 && rayDirY < 0) texX = textureWidth - texX - 1;

        const step = textureHeight / lineHeight;
        let texPos = (drawStart - screenHeight / 2 + lineHeight / 2) * step;

        for (let y = drawStart; y < drawEnd; y++) {
            const texY = Math.floor(texPos) & (textureHeight - 1);
            texPos += step;

            const wallTexIndex = (texY * textureWidth + texX) * 4;
            const screenIndex = (y * screenWidth + x) * 4;

            const distanceShade = Math.max(0.3, 1 - perpWallDist / 15);
            const shade = (side === 1 ? 0.7 : 1.0) * distanceShade;

            screenImageData.data[screenIndex] = textures.wall.data[wallTexIndex] * shade;
            screenImageData.data[screenIndex + 1] = textures.wall.data[wallTexIndex + 1] * shade;
            screenImageData.data[screenIndex + 2] = textures.wall.data[wallTexIndex + 2] * shade;
            screenImageData.data[screenIndex + 3] = 255;
        }
    }
    ctx.putImageData(screenImageData, 0, 0);

    gameState.sprites.sort((a, b) => Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y));

    for (let i = 0; i < gameState.sprites.length; i++) {
        const sprite = gameState.sprites[i];
        const spriteX = sprite.x - p.x;
        const spriteY = sprite.y - p.y;
        const invDet = 1.0 / (p.planeX * p.dirY - p.dirX * p.planeY);
        const transformX = invDet * (p.dirY * spriteX - p.dirX * spriteY);
        const transformY = invDet * (-p.planeY * spriteX + p.planeX * spriteY);

        if (transformY > 0) {
            const spriteScreenX = Math.floor((screenWidth / 2) * (1 + transformX / transformY));
            let spriteScale = 1.0, spriteAspectRatio = 1.0, spriteColor;

            if (sprite.type === 'enemy') {
                spriteScale = ENEMY_TYPES[sprite.subType].scale;
                spriteAspectRatio = ENEMY_TYPES[sprite.subType].aspectRatio;
                spriteColor = sprite.isHit > 0 ? '#ffcccc' : ENEMY_TYPES[sprite.subType].color;
                if (sprite.state === 'dead') spriteColor = '#404040';
            } else if (sprite.type === 'pickup') {
                spriteScale = 0.25;
                if (sprite.subType === 'ammo') spriteColor = '#ffff00';
                else if (sprite.subType === 'health') spriteColor = '#ff0000';
                else if (sprite.subType === 'shield') spriteColor = '#0000ff';
                else if (sprite.subType === 'key') { spriteColor = '#f0e68c'; spriteScale = 0.4; }
            } else if (sprite.type === 'exit') {
                spriteColor = '#ffffff'; spriteScale = 1.2; spriteAspectRatio = 0.5;
            } else if (sprite.type === 'projectile') {
                spriteScale = 0.15;
                spriteColor = sprite.color;
            } else if (sprite.type === 'playerBullet') {
                spriteScale = 0.1;
                spriteColor = sprite.color;
            } else if (sprite.type === 'impact') {
                spriteScale = 0.2 + (20 - sprite.lifetime) * 0.02; // Grows over time
                const alpha = sprite.lifetime / 20; // Fades over time
                const r = parseInt(sprite.color.slice(1, 3), 16);
                const g = parseInt(sprite.color.slice(3, 5), 16);
                const b = parseInt(sprite.color.slice(5, 7), 16);
                spriteColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            }

            const spriteHeight = Math.abs(Math.floor(screenHeight / transformY)) * spriteScale;
            const spriteWidth = spriteHeight * spriteAspectRatio;
            const drawStartY = -spriteHeight / 2 + screenHeight / 2;
            const drawEndX = spriteWidth / 2 + spriteScreenX;

            for (let stripe = Math.floor(drawEndX - spriteWidth); stripe < Math.floor(drawEndX); stripe++) {
                if (stripe >= 0 && stripe < screenWidth && transformY < gameState.zBuffer[stripe]) {
                    ctx.fillStyle = spriteColor;
                    
                    // Special rendering for impact effects
                    if (sprite.type === 'impact') {
                        // Draw a burst pattern for impact effects
                        const centerX = spriteScreenX;
                        const centerY = drawStartY + spriteHeight / 2;
                        const radius = spriteHeight / 2;
                        
                        ctx.beginPath();
                        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                        ctx.fill();
                        
                        // Add some spark lines
                        ctx.strokeStyle = spriteColor;
                        ctx.lineWidth = 2;
                        for (let spark = 0; spark < 6; spark++) {
                            const angle = (spark / 6) * 2 * Math.PI;
                            const sparkLength = radius * 1.5;
                            ctx.beginPath();
                            ctx.moveTo(centerX, centerY);
                            ctx.lineTo(
                                centerX + Math.cos(angle) * sparkLength,
                                centerY + Math.sin(angle) * sparkLength
                            );
                            ctx.stroke();
                        }
                        break; // Don't draw the regular rectangle for impacts
                    } else {
                        ctx.fillRect(stripe, drawStartY, 1, spriteHeight);
                    }
                    
                    if (sprite.type === 'enemy' && sprite.state !== 'dead') {
                        const healthBarWidth = spriteWidth * (sprite.health / ENEMY_TYPES[sprite.subType].health);
                        ctx.fillStyle = 'red';
                        ctx.fillRect(drawEndX - spriteWidth, drawStartY - 10, spriteWidth, 5);
                        ctx.fillStyle = 'green';
                        ctx.fillRect(drawEndX - spriteWidth, drawStartY - 10, healthBarWidth, 5);
                    }
                }
            }
        }
    }

    if (p.isHit > 0) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(0, 0, screenWidth, screenHeight);
    }

    // --- Minimap Rendering ---
    const miniMapSize = 120;
    const miniMapX = screenWidth - miniMapSize - 10;
    const miniMapY = 10;
    const tileSize = miniMapSize / gameState.mapWidth;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(miniMapX, miniMapY, miniMapSize, miniMapSize);

    for (let y = 0; y < gameState.mapHeight; y++) {
        for (let x = 0; x < gameState.mapWidth; x++) {
            if (gameState.map[y][x] === 1) {
                ctx.fillStyle = 'rgba(200, 200, 200, 0.6)';
                ctx.fillRect(miniMapX + x * tileSize, miniMapY + y * tileSize, tileSize, tileSize);
            }
        }
    }

    for (let i = 0; i < gameState.sprites.length; i++) {
        const sprite = gameState.sprites[i];
        let color = null;
        if (sprite.type === 'enemy' && sprite.state !== 'dead') color = 'red';
        else if (sprite.type === 'pickup' && sprite.subType === 'key') color = '#f0e68c';
        else if (sprite.type === 'exit') color = 'white';

        if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(miniMapX + sprite.x * tileSize - 1, miniMapY + sprite.y * tileSize - 1, 3, 3);
        }
    }

    const playerMiniMapX = miniMapX + p.x * tileSize;
    const playerMiniMapY = miniMapY + p.y * tileSize;
    ctx.fillStyle = 'yellow';
    ctx.fillRect(playerMiniMapX - 2, playerMiniMapY - 2, 4, 4);

    // Draw player direction indicator
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(playerMiniMapX, playerMiniMapY);
    ctx.lineTo(
        playerMiniMapX + p.dirX * 5,
        playerMiniMapY + p.dirY * 5
    );
    ctx.stroke();

    // --- UI Text ---
    document.getElementById('level-ui').innerText = `Level: ${gameState.currentLevel}`;
    document.getElementById('health-ui').innerText = `Health: ${p.health}`;
    document.getElementById('shield-ui').innerText = `Shield: ${p.shield}`;
    document.getElementById('ammo-ui').innerText = `Ammo: ${p.clipAmmo} / ${p.ammo}`;
    document.getElementById('score-ui').innerText = `Score: ${p.score}`;
}

function gameLoop() {
    updateState();
    render();
    requestAnimationFrame(gameLoop);
}

generateLevel(1).then(() => {
    gameLoop();
    
    // Add click to start message
    const startMessage = document.createElement('div');
    startMessage.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        z-index: 1000;
        font-family: 'Courier New', monospace;
    `;
    startMessage.innerHTML = 'Click to Start Game<br><small>Audio will be enabled</small>';
    document.body.appendChild(startMessage);
    
    canvas.addEventListener('click', function initGame() {
        audioManager.init();
        audioManager.startLoFiSound();
        startMessage.remove();
        canvas.removeEventListener('click', initGame);
    }, { once: true });
});
