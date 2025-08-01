// --- Rendering Module ---

/**
 * Main rendering function - orchestrates all rendering operations
 */
function renderFrame() {
    const p = gameState.player;
    ctx.clearRect(0, 0, screenWidth, screenHeight);
    const screenImageData = ctx.createImageData(screenWidth, screenHeight);

    // Render floor and ceiling
    renderFloorAndCeiling(screenImageData, p);
    
    // Render walls using raycasting
    renderRaycasting(screenImageData, p);
    
    // Put the rendered image data to canvas
    ctx.putImageData(screenImageData, 0, 0);

    // Render sprites (enemies, pickups, projectiles)
    renderSprites(p);

    // Render hit effect
    renderHitEffect(p);

    // Render minimap
    renderMinimap(p);

    // Render UI elements
    renderUI();

    // Render crosshair
    renderCrosshair();

    // Render loading screen if needed
    if (isLoading) {
        renderLoadingScreen();
    }

    // Render notifications
    renderNotifications();
}

/**
 * Render floor and ceiling with texturing
 */
function renderFloorAndCeiling(screenImageData, p) {
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
}

/**
 * Render walls using raycasting algorithm
 */
function renderRaycasting(screenImageData, p) {
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

        // Wall texturing
        let wallX;
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
}

/**
 * Render all sprites (enemies, pickups, projectiles, effects)
 */
function renderSprites(p) {
    // Sort sprites by distance for proper depth rendering
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

            // Determine sprite properties based on type
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
                        renderImpactEffect(sprite, spriteScreenX, drawStartY + spriteHeight / 2, spriteHeight / 2, spriteColor);
                        break; // Don't draw the regular rectangle for impacts
                    } else {
                        ctx.fillRect(stripe, drawStartY, 1, spriteHeight);
                    }

                    // Render enemy health bars
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
}

/**
 * Render impact effect with burst pattern
 */
function renderImpactEffect(sprite, centerX, centerY, radius, spriteColor) {
    // Draw a burst pattern for impact effects
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
}

/**
 * Render player hit effect (red overlay)
 */
function renderHitEffect(p) {
    if (p.isHit > 0) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(0, 0, screenWidth, screenHeight);
    }
}

/**
 * Render minimap
 */
function renderMinimap(p) {
    const miniMapSize = 120 * uiScale;
    const miniMapX = screenWidth - miniMapSize - 10 * uiScale;
    const miniMapY = 60 * uiScale; // Move down to avoid fullscreen button
    const tileSize = miniMapSize / gameState.mapWidth;

    // Minimap background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(miniMapX, miniMapY, miniMapSize, miniMapSize);

    // Render map walls (flip Y-axis to match game world orientation)
    for (let y = 0; y < gameState.mapHeight; y++) {
        for (let x = 0; x < gameState.mapWidth; x++) {
            if (gameState.map[y][x] === 1) {
                ctx.fillStyle = 'rgba(200, 200, 200, 0.6)';
                // Flip Y coordinate: use (mapHeight - 1 - y) instead of y
                const flippedY = gameState.mapHeight - 1 - y;
                ctx.fillRect(miniMapX + x * tileSize, miniMapY + flippedY * tileSize, tileSize, tileSize);
            }
        }
    }

    // Render sprites on minimap (flip Y-axis to match game world orientation)
    for (let i = 0; i < gameState.sprites.length; i++) {
        const sprite = gameState.sprites[i];
        let color = null;
        if (sprite.type === 'enemy' && sprite.state !== 'dead') color = 'red';
        else if (sprite.type === 'pickup' && sprite.subType === 'key') color = '#f0e68c';
        else if (sprite.type === 'pickup' && (sprite.subType === 'shotgun' || sprite.subType === 'machinegun')) color = '#00ff00';
        else if (sprite.type === 'exit') color = 'white';

        if (color) {
            ctx.fillStyle = color;
            // Flip Y coordinate: use (mapHeight - sprite.y) instead of sprite.y
            const flippedSpriteY = gameState.mapHeight - sprite.y;
            ctx.fillRect(miniMapX + sprite.x * tileSize - 1, miniMapY + flippedSpriteY * tileSize - 1, 3, 3);
        }
    }

    // Render player on minimap (flip Y-axis to match game world orientation)
    const playerMiniMapX = miniMapX + p.x * tileSize;
    // Flip Y coordinate: use (mapHeight - p.y) instead of p.y
    const playerMiniMapY = miniMapY + (gameState.mapHeight - p.y) * tileSize;
    ctx.fillStyle = 'yellow';
    ctx.fillRect(playerMiniMapX - 2, playerMiniMapY - 2, 4, 4);

    // Draw player direction indicator (flip Y direction to match game world orientation)
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(playerMiniMapX, playerMiniMapY);
    ctx.lineTo(
        playerMiniMapX + p.dirX * 5,
        playerMiniMapY - p.dirY * 5  // Flip Y direction: use -p.dirY instead of +p.dirY
    );
    ctx.stroke();
}

/**
 * Render UI elements (health, ammo, score, etc.)
 */
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

/**
 * Render crosshair
 */
function renderCrosshair() {
    ctx.fillStyle = 'white';
    ctx.font = `${20 * uiScale}px Courier New`;
    ctx.textAlign = 'center';
    ctx.fillText('+', screenWidth / 2, screenHeight / 2 + 7 * uiScale);
}

/**
 * Render loading screen
 */
function renderLoadingScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, screenWidth, screenHeight);

    ctx.fillStyle = 'white';
    ctx.font = `${32 * uiScale}px Courier New`;
    ctx.textAlign = 'center';
    ctx.fillText('Generating Level...', screenWidth / 2, screenHeight / 2);
}

/**
 * Render notifications
 */
function renderNotifications() {
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
}

// --- Exports ---
window.renderFrame = renderFrame;
window.renderRaycasting = renderRaycasting;
window.renderSprites = renderSprites;
window.renderUI = renderUI;
window.renderEffects = renderNotifications; // Alias for effects (notifications)