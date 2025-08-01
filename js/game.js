// --- Game Constants ---
const MAX_HEALTH = 100;
const MAX_SHIELD = 100;
const MAX_AMMO_CARRY = 200; // Increased for machine gun

const ENEMY_TYPES = {
    'grunt': { health: 100, damage: 10, color: '#00ff00', scale: 1.0, aspectRatio: 0.8, score: 100, attackCooldown: 120 },
    'sergeant': { health: 150, damage: 20, color: '#00bfff', scale: 1.1, aspectRatio: 0.8, score: 200, attackCooldown: 100 },
    'commander': { health: 200, damage: 30, color: '#ff4500', scale: 1.2, aspectRatio: 0.8, score: 300, attackCooldown: 80 },
    'boss': { health: 500, damage: 50, color: '#ff00ff', scale: 1.5, aspectRatio: 0.8, score: 1000, attackCooldown: 60 }
};

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
        score: 0,
        isHit: 0,
        hasKey: false,
        stepTimer: 0
    },
    map: [],
    mapWidth: 25, // Must be odd
    mapHeight: 25, // Must be odd
    sprites: [],
    zBuffer: null // Will be initialized after canvas setup
};

// --- Notification System ---
let notification = { message: '', timer: 0 };

function showNotification(message, duration = 120) { // 120 frames = 2 seconds at 60fps
    notification.message = message;
    notification.timer = duration;
}

// --- Loading State ---
let isLoading = false;

function showLoadingScreen() {
    isLoading = true;
}

function hideLoadingScreen() {
    isLoading = false;
}

/**
 * Initialize game state with proper zBuffer size
 */
function initializeGameState() {
    // Initialize zBuffer after canvas is set up
    gameState.zBuffer = new Array(screenWidth);
    
    // Reset player to initial state
    gameState.player = {
        x: 0, y: 0,
        dirX: -1, dirY: 0,
        planeX: 0, planeY: 0.66,
        moveSpeed: 0.05, rotSpeed: 0.03,
        health: MAX_HEALTH,
        shield: 0,
        ammo: MAX_AMMO_CARRY,
        score: 0,
        isHit: 0,
        hasKey: false,
        stepTimer: 0
    };
    
    gameState.currentLevel = 1;
    gameState.sprites = [];
    gameState.map = [];
}/**
 * G
enerate map using randomized DFS maze algorithm
 */
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
    while (openings > 0) {
        const x = Math.floor(Math.random() * (w - 2)) + 1;
        const y = Math.floor(Math.random() * (h - 2)) + 1;
        if (map[y][x] === 1) {
            map[y][x] = 0;
            openings--;
        }
    }

    gameState.map = map;
}

/**
 * Generate level with enemies, pickups, and player placement
 */
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
            if (gameState.map[y][x] === 0) emptyTiles.push({ x: x + 0.5, y: y + 0.5 });
        }
    }

    const placeItem = (count, type, subType) => {
        for (let i = 0; i < count; i++) {
            if (emptyTiles.length === 0) return;
            const tileIndex = Math.floor(Math.random() * emptyTiles.length);
            const tile = emptyTiles.splice(tileIndex, 1)[0];
            if (type === 'enemy') {
                gameState.sprites.push({ 
                    x: tile.x, y: tile.y, 
                    type: 'enemy', 
                    subType: subType, 
                    health: ENEMY_TYPES[subType].health, 
                    state: 'idle', 
                    isHit: 0, 
                    attackTimer: 0 
                });
            } else {
                gameState.sprites.push({ x: tile.x, y: tile.y, type: 'pickup', subType: subType });
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

    placeItem(Math.max(1, 5 - Math.floor(level / 2)), 'pickup', 'ammo');
    placeItem(Math.max(1, 4 - Math.floor(level / 2)), 'pickup', 'health');
    placeItem(Math.max(1, 3 - Math.floor(level / 3)), 'pickup', 'shield');

    // Place weapon pickups (less frequent)
    if (level >= 2) placeItem(1, 'pickup', 'shotgun');
    if (level >= 4) placeItem(1, 'pickup', 'machinegun');

    hideLoadingScreen();
}

/**
 * Spawn exit door when boss is defeated
 */
function spawnExitDoor() {
    const emptyTiles = [];
    for (let y = 0; y < gameState.mapHeight; y++) {
        for (let x = 0; x < gameState.mapWidth; x++) {
            if (gameState.map[y][x] === 0 && Math.hypot(x - gameState.player.x, y - gameState.player.y) > 10) {
                emptyTiles.push({ x: x + 0.5, y: y + 0.5 });
            }
        }
    }
    if (emptyTiles.length > 0) {
        const tile = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
        gameState.sprites.push({ x: tile.x, y: tile.y, type: 'exit' });
    }
}/**

 * Handle player input for movement and actions
 */
function handlePlayerInput() {
    const p = gameState.player;
    const moveSpeed = p.moveSpeed;
    let isMoving = false;
    
    // Movement input
    if (keys['KeyW'] || keys['ArrowUp']) {
        if (gameState.map[Math.floor(p.y)][Math.floor(p.x + p.dirX * moveSpeed)] == 0) { 
            p.x += p.dirX * moveSpeed; 
            isMoving = true; 
        }
        if (gameState.map[Math.floor(p.y + p.dirY * moveSpeed)][Math.floor(p.x)] == 0) { 
            p.y += p.dirY * moveSpeed; 
            isMoving = true; 
        }
    }
    if (keys['KeyS'] || keys['ArrowDown']) {
        if (gameState.map[Math.floor(p.y)][Math.floor(p.x - p.dirX * moveSpeed)] == 0) { 
            p.x -= p.dirX * moveSpeed; 
            isMoving = true; 
        }
        if (gameState.map[Math.floor(p.y - p.dirY * moveSpeed)][Math.floor(p.x)] == 0) { 
            p.y -= p.dirY * moveSpeed; 
            isMoving = true; 
        }
    }
    if (keys['KeyD']) {
        if (gameState.map[Math.floor(p.y)][Math.floor(p.x + p.planeX * moveSpeed)] == 0) { 
            p.x += p.planeX * moveSpeed; 
            isMoving = true; 
        }
        if (gameState.map[Math.floor(p.y + p.planeY * moveSpeed)][Math.floor(p.x)] == 0) { 
            p.y += p.planeY * moveSpeed; 
            isMoving = true; 
        }
    }
    if (keys['KeyA']) {
        if (gameState.map[Math.floor(p.y)][Math.floor(p.x - p.planeX * moveSpeed)] == 0) { 
            p.x -= p.planeX * moveSpeed; 
            isMoving = true; 
        }
        if (gameState.map[Math.floor(p.y - p.planeY * moveSpeed)][Math.floor(p.x)] == 0) { 
            p.y -= p.planeY * moveSpeed; 
            isMoving = true; 
        }
    }
    
    // Handle step sounds
    if (isMoving) {
        p.stepTimer++;
        if (p.stepTimer >= 15) { // Play step sound every 15 frames when moving
            audioManager.play('step');
            p.stepTimer = 0;
        }
    } else {
        p.stepTimer = 0;
    }
    
    // Action input
    if (keys['KeyR']) reload();

    // Weapon switching
    if (keys['Digit1']) weaponManager.switchWeapon('pistol');
    if (keys['Digit2']) weaponManager.switchWeapon('shotgun');
    if (keys['Digit3']) weaponManager.switchWeapon('machinegun');
}

/**
 * Game logic functions
 */
function shoot() {
    weaponManager.shoot(gameState.player);
}

function reload() {
    weaponManager.startReload();
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

/**
 * Line of sight visibility check using Bresenham's line algorithm
 */
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
}/**

 * Main game state update function - handles all game mechanics and state changes
 */
function updateGameState() {
    const p = gameState.player;
    
    // Handle player input
    handlePlayerInput();

    // Update weapon manager
    weaponManager.update();

    // Process all sprites (enemies, pickups, projectiles, etc.)
    for (let i = gameState.sprites.length - 1; i >= 0; i--) {
        const sprite = gameState.sprites[i];
        const dist = Math.hypot(p.x - sprite.x, p.y - sprite.y);

        // Handle pickup collision
        if (dist < 0.5) {
            if (sprite.type === 'pickup') {
                let pickedUp = false;
                if (sprite.subType === 'ammo' && p.ammo < MAX_AMMO_CARRY) { 
                    p.ammo = Math.min(MAX_AMMO_CARRY, p.ammo + 30); 
                    p.score += 10; 
                    gameState.sprites.splice(i, 1); 
                    pickedUp = true; 
                }
                if (sprite.subType === 'health' && p.health < MAX_HEALTH) { 
                    p.health = Math.min(MAX_HEALTH, p.health + 25); 
                    p.score += 10; 
                    gameState.sprites.splice(i, 1); 
                    pickedUp = true; 
                }
                if (sprite.subType === 'shield' && p.shield < MAX_SHIELD) { 
                    p.shield = Math.min(MAX_SHIELD, p.shield + 50); 
                    p.score += 10; 
                    gameState.sprites.splice(i, 1); 
                    pickedUp = true; 
                }
                if (sprite.subType === 'key') { 
                    p.hasKey = true; 
                    p.score += 500; 
                    gameState.sprites.splice(i, 1); 
                    pickedUp = true; 
                }
                if (sprite.subType === 'shotgun' || sprite.subType === 'machinegun') {
                    if (weaponManager.pickupWeapon(sprite.subType)) {
                        p.score += 100;
                        gameState.sprites.splice(i, 1);
                        pickedUp = true;
                    }
                }
                if (pickedUp) {
                    audioManager.play('pickup');
                }
            } else if (sprite.type === 'exit' && p.hasKey) {
                generateLevel(gameState.currentLevel + 1);
                return; // Stop processing this frame
            }
        }

        // Handle enemy AI and behavior
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
                if (gameState.map[Math.floor(sprite.y)][Math.floor(sprite.x + moveDirX * enemyMoveSpeed)] == 0) 
                    sprite.x += moveDirX * enemyMoveSpeed;
                if (gameState.map[Math.floor(sprite.y + moveDirY * enemyMoveSpeed)][Math.floor(sprite.x)] == 0) 
                    sprite.y += moveDirY * enemyMoveSpeed;
            } else if (sprite.state === 'attacking') {
                sprite.attackTimer = (sprite.attackTimer || 0) + 1;
                if (sprite.attackTimer >= ENEMY_TYPES[sprite.subType].attackCooldown) {
                    sprite.attackTimer = 0;
                    const bulletDirX = (p.x - sprite.x) / dist;
                    const bulletDirY = (p.y - sprite.y) / dist;
                    gameState.sprites.push({ 
                        type: 'projectile', 
                        x: sprite.x, 
                        y: sprite.y, 
                        dirX: bulletDirX, 
                        dirY: bulletDirY, 
                        speed: 0.1, 
                        damage: ENEMY_TYPES[sprite.subType].damage, 
                        color: '#FFA500' 
                    });
                }
            }
        } 
        // Handle enemy projectiles
        else if (sprite.type === 'projectile') {
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
        } 
        // Handle player bullets
        else if (sprite.type === 'playerBullet') {
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
                                gameState.sprites.push({ x: enemy.x, y: enemy.y, type: 'pickup', subType: 'key' });
                                spawnExitDoor();
                            }
                        }

                        // Remove bullet
                        gameState.sprites.splice(i, 1);
                        break;
                    }
                }
            }
        } 
        // Handle impact effects
        else if (sprite.type === 'impact') {
            sprite.lifetime--;
            if (sprite.lifetime <= 0) {
                gameState.sprites.splice(i, 1);
            }
        }
    }
    
    // Reduce player hit effect
    if (p.isHit > 0) p.isHit--;
}

// --- Exports ---
// Export constants
window.MAX_HEALTH = MAX_HEALTH;
window.MAX_SHIELD = MAX_SHIELD;
window.MAX_AMMO_CARRY = MAX_AMMO_CARRY;
window.ENEMY_TYPES = ENEMY_TYPES;

// Export game state
window.gameState = gameState;

// Export notification system
window.notification = notification;
window.showNotification = showNotification;

// Export loading state
window.isLoading = isLoading;
window.showLoadingScreen = showLoadingScreen;
window.hideLoadingScreen = hideLoadingScreen;

// Export game functions
window.initializeGameState = initializeGameState;
window.generateMap = generateMap;
window.generateLevel = generateLevel;
window.updateGameState = updateGameState;
window.handlePlayerInput = handlePlayerInput;
window.shoot = shoot;
window.reload = reload;
window.playerTakeDamage = playerTakeDamage;
window.isVisible = isVisible;
window.spawnExitDoor = spawnExitDoor;