// Game constants are now handled by game.js

// --- Setup and Configuration ---
// Canvas, dimensions, and textures are now handled by setup.js
// Initialize canvas and generate textures
initializeCanvas();
generateTextures();
setupInputHandlers();

// Initialize game state after canvas setup
initializeGameState();

// Game state and notification system are now handled by game.js



// Map generation is now handled by game.js

// Level management is now handled by game.js

// Game logic functions are now handled by game.js

// Game state update is now handled by game.js

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
                else if (sprite.subType === 'shotgun') { spriteColor = WEAPON_TYPES.shotgun.pickupColor; spriteScale = 0.35; }
                else if (sprite.subType === 'machinegun') { spriteColor = WEAPON_TYPES.machinegun.pickupColor; spriteScale = 0.35; }
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
    const miniMapSize = 120 * uiScale;
    const miniMapX = screenWidth - miniMapSize - 10 * uiScale;
    const miniMapY = 60 * uiScale; // Move down to avoid fullscreen button
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
        else if (sprite.type === 'pickup' && (sprite.subType === 'shotgun' || sprite.subType === 'machinegun')) color = '#00ff00';
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

    // --- In-Canvas UI Rendering ---
    renderUI();

    // --- Crosshair ---
    ctx.fillStyle = 'white';
    ctx.font = `${20 * uiScale}px Courier New`;
    ctx.textAlign = 'center';
    ctx.fillText('+', screenWidth / 2, screenHeight / 2 + 7 * uiScale);

    // --- Loading Screen ---
    if (isLoading) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, screenWidth, screenHeight);

        ctx.fillStyle = 'white';
        ctx.font = `${32 * uiScale}px Courier New`;
        ctx.textAlign = 'center';
        ctx.fillText('Generating Level...', screenWidth / 2, screenHeight / 2);
    }

    // --- Notifications ---
    if (notification.timer > 0) {
        notification.timer--;
        const alpha = Math.min(1, notification.timer / 30);
        ctx.fillStyle = `rgba(0, 0, 0, ${0.8 * alpha})`;
        const notifWidth = 400 * uiScale;
        const notifHeight = 60 * uiScale;
        const notifX = (screenWidth - notifWidth) / 2;
        const notifY = (screenHeight - notifHeight) / 2;

        ctx.fillRect(notifX, notifY, notifWidth, notifHeight);
        ctx.strokeStyle = `rgba(136, 136, 136, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(notifX, notifY, notifWidth, notifHeight);

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.font = `${16 * uiScale}px Courier New`;
        ctx.textAlign = 'center';
        ctx.fillText(notification.message, screenWidth / 2, screenHeight / 2 + 5 * uiScale);
    }

    function renderUI() {
        const p = gameState.player;
        const padding = 20 * uiScale;
        const uiHeight = 100 * uiScale;

        // Modern UI Background with gradient effect
        const gradient = ctx.createLinearGradient(0, screenHeight - uiHeight, 0, screenHeight);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
        gradient.addColorStop(1, 'rgba(20, 20, 20, 0.95)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, screenHeight - uiHeight, screenWidth, uiHeight);

        // Top border line
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(0, screenHeight - uiHeight, screenWidth, 2);

        // === LEFT SIDE: Health & Shield ===
        const barWidth = 180 * uiScale;
        const barHeight = 12 * uiScale;
        const leftX = padding;
        const topY = screenHeight - uiHeight + 20 * uiScale;

        // Health Bar with emoji
        ctx.font = `${18 * uiScale}px Arial`;
        ctx.fillStyle = '#ff4444';
        ctx.textAlign = 'left';
        ctx.fillText('❤️', leftX, topY);

        const healthBarX = leftX + 30 * uiScale;
        // Health bar background
        ctx.fillStyle = 'rgba(100, 0, 0, 0.5)';
        ctx.fillRect(healthBarX, topY - 10 * uiScale, barWidth, barHeight);
        // Health bar fill
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(healthBarX, topY - 10 * uiScale, (p.health / MAX_HEALTH) * barWidth, barHeight);
        // Health text
        ctx.font = `${12 * uiScale}px Arial`;
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(`${p.health}`, healthBarX + barWidth / 2, topY - 2 * uiScale);

        // Shield Bar (only if shield > 0)
        if (p.shield > 0) {
            const shieldY = topY + 25 * uiScale;
            ctx.font = `${18 * uiScale}px Arial`;
            ctx.fillStyle = '#4488ff';
            ctx.textAlign = 'left';
            ctx.fillText('🛡️', leftX, shieldY);

            // Shield bar background
            ctx.fillStyle = 'rgba(0, 0, 100, 0.5)';
            ctx.fillRect(healthBarX, shieldY - 10 * uiScale, barWidth, barHeight);
            // Shield bar fill
            ctx.fillStyle = '#4488ff';
            ctx.fillRect(healthBarX, shieldY - 10 * uiScale, (p.shield / MAX_SHIELD) * barWidth, barHeight);
            // Shield text
            ctx.font = `${12 * uiScale}px Arial`;
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.fillText(`${p.shield}`, healthBarX + barWidth / 2, shieldY - 2 * uiScale);
        }

        // === CENTER: Weapon Info ===
        const centerX = screenWidth / 2;
        const weaponY = screenHeight - uiHeight + 30 * uiScale;

        ctx.font = `${16 * uiScale}px Arial`;
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';

        let weaponText = `🔫 ${weaponManager.getWeaponName()}`;
        if (weaponManager.isReloading) {
            const progress = Math.floor(weaponManager.getReloadProgress() * 100);
            weaponText = `🔄 Reloading ${progress}%`;
            ctx.fillStyle = '#ffaa00';
        }
        ctx.fillText(weaponText, centerX, weaponY);

        // Ammo display
        ctx.font = `${14 * uiScale}px Arial`;
        ctx.fillStyle = '#ffdd44';
        ctx.fillText(`📦 ${weaponManager.getAmmoDisplay()}`, centerX, weaponY + 25 * uiScale);

        // === RIGHT SIDE: Level & Score ===
        const rightX = screenWidth - padding;

        ctx.font = `${14 * uiScale}px Arial`;
        ctx.fillStyle = '#44ff44';
        ctx.textAlign = 'right';
        ctx.fillText(`🏆 Level ${gameState.currentLevel}`, rightX, topY);

        ctx.fillStyle = '#ffff44';
        ctx.fillText(`💰 ${p.score.toLocaleString()}`, rightX, topY + 25 * uiScale);

        // === BOTTOM: Controls ===
        ctx.font = `${10 * uiScale}px Arial`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'center';
        const controlsY = screenHeight - 8 * uiScale;
        ctx.fillText('WASD: Move • Mouse: Look • Click: Shoot • R: Reload • 1/2/3: Switch Weapons', centerX, controlsY);
    }
}

function gameLoop() {
    updateGameState();
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
        // Set up the ongoing click handler for gameplay
        setupCanvasClickHandler();
    }, { once: true });
});
